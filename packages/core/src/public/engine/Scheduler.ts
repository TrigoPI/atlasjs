import { createLogger, Logger } from "@atlasjs/utils";

import { STAGES_BY_LANE } from "./Stages";
import {
  Lane,
  LaneScheduler,
  LegacyStepFn,
  Stage,
  StepContext,
  StepFn,
  StepHandle,
  StepOptions,
  StepSet,
  StepSpec,
} from "./types";

const WITHIN_STAGE_EPSILON = 1e-3;

export class SchedulerCycleError extends Error {
  public constructor(lane: Lane, stage: string, path: string[]) {
    super(
      `Scheduler cycle in lane "${lane}", stage "${stage}": ${path.join(
        " -> ",
      )}`,
    );
    this.name = "SchedulerCycleError";
  }
}

type Entry = {
  name: string;
  fn: StepFn;
  seq: number;
  enabled: boolean;
  setName?: string;
  stage?: Stage;
  before: string[];
  after: string[];
  legacyPriority?: number;
};

function asArray(v: string | readonly string[] | undefined): string[] {
  if (v === undefined) return [];
  return typeof v === "string" ? [v] : [...v];
}

class LaneSchedulerImpl implements LaneScheduler {
  public readonly lane: Lane;

  private readonly logger: Logger;
  private readonly stages: readonly Stage[];
  private readonly entries: Map<string, Entry>;

  private compiled: Entry[];
  private dirty: boolean;
  private seqCounter: number;

  public constructor(lane: Lane, logger: Logger) {
    this.lane = lane;
    this.logger = logger;
    this.stages = STAGES_BY_LANE[lane];
    this.entries = new Map<string, Entry>();
    this.compiled = [];
    this.dirty = false;
    this.seqCounter = 0;
  }

  public add(fn: StepFn, spec: StepSpec, setName?: string): StepHandle {
    this.assertStage(spec.stage);

    const entry: Entry = {
      name: spec.name,
      fn,
      seq: this.seqCounter++,
      enabled: spec.enabled ?? true,
      setName,
      stage: this.stages.find((s: Stage) => s.name === spec.stage),
      before: asArray(spec.before),
      after: asArray(spec.after),
    };

    this.insert(entry);
    return this.handleFor(entry);
  }

  /** @deprecated Legacy numeric-priority registration. */
  public addLegacy(fn: LegacyStepFn, opts: StepOptions): StepHandle {
    const entry: Entry = {
      name: opts.name,
      fn: (ctx: StepContext) => fn(ctx.dt),
      seq: this.seqCounter++,
      enabled: true,
      before: [],
      after: [],
      legacyPriority: opts.priority + (opts.id ?? 0),
    };

    this.insert(entry);
    this.logger.log(
      `Registering ${this.lane} step (legacy): ${entry.name}:${entry.legacyPriority}`,
    );
    return this.handleFor(entry);
  }

  public run(ctx: StepContext): void {
    if (this.dirty) {
      this.compile();
    }

    for (let i = 0; i < this.compiled.length; i++) {
      const entry: Entry = this.compiled[i];
      if (entry.enabled) {
        entry.fn(ctx);
      }
    }
  }

  private insert(entry: Entry): void {
    if (this.entries.has(entry.name)) {
      throw new Error(
        `Duplicate step name "${entry.name}" in lane "${this.lane}".`,
      );
    }

    this.entries.set(entry.name, entry);
    this.dirty = true;
  }

  private remove(name: string): void {
    if (this.entries.delete(name)) {
      this.dirty = true;
    }
  }

  private handleFor(entry: Entry): StepHandle {
    const lane: Lane = this.lane;
    return {
      name: entry.name,
      lane,
      remove: () => this.remove(entry.name),
      setEnabled: (enabled: boolean) => {
        entry.enabled = enabled;
      },
    };
  }

  private assertStage(stage: string): void {
    if (!this.stages.some((s: Stage) => s.name === stage)) {
      const names: string = this.stages.map((s: Stage) => s.name).join(", ");
      throw new Error(
        `Unknown stage "${stage}" for lane "${this.lane}". Valid stages: ${names}.`,
      );
    }
  }

  private compile(): void {
    const all: Entry[] = [...this.entries.values()];
    const keyed: { entry: Entry; key: number }[] = [];

    // Staged entries: bucket by stage, topologically sort within each stage.
    for (const stage of this.stages) {
      const inStage: Entry[] = all.filter(
        (e: Entry) => e.stage?.name === stage.name,
      );

      if (inStage.length === 0) continue;

      const ordered: Entry[] = this.topoSortStage(stage, inStage);

      for (let rank = 0; rank < ordered.length; rank++) {
        keyed.push({
          entry: ordered[rank],
          key: stage.anchor + rank * WITHIN_STAGE_EPSILON,
        });
      }
    }

    // Legacy entries: ordered by their numeric priority.
    for (const entry of all) {
      if (entry.legacyPriority !== undefined) {
        keyed.push({ entry, key: entry.legacyPriority });
      }
    }

    keyed.sort((a, b) => a.key - b.key || a.entry.seq - b.entry.seq);
    this.compiled = keyed.map((k) => k.entry);
    this.dirty = false;
  }

  private topoSortStage(stage: Stage, entries: Entry[]): Entry[] {
    const byName: Map<string, Entry> = new Map(
      entries.map((e: Entry) => [e.name, e]),
    );
    const indegree: Map<string, number> = new Map(
      entries.map((e: Entry) => [e.name, 0]),
    );
    const adjacency: Map<string, string[]> = new Map(
      entries.map((e: Entry) => [e.name, []]),
    );

    const edge = (from: string, to: string): void => {
      adjacency.get(from)!.push(to);
      indegree.set(to, indegree.get(to)! + 1);
    };

    for (const entry of entries) {
      for (const target of entry.before) {
        this.assertSameStage(stage, entry, target, byName, "before");
        edge(entry.name, target);
      }
      for (const target of entry.after) {
        this.assertSameStage(stage, entry, target, byName, "after");
        edge(target, entry.name);
      }
    }

    // Kahn's algorithm, seeded in insertion (seq) order for stable output.
    const bySeq = (a: string, b: string): number =>
      byName.get(a)!.seq - byName.get(b)!.seq;

    const ready: string[] = entries
      .filter((e: Entry) => indegree.get(e.name) === 0)
      .map((e: Entry) => e.name)
      .sort(bySeq);

    const result: Entry[] = [];

    while (ready.length > 0) {
      const name: string = ready.shift()!;
      result.push(byName.get(name)!);

      const next: string[] = [];
      for (const neighbor of adjacency.get(name)!) {
        const deg: number = indegree.get(neighbor)! - 1;
        indegree.set(neighbor, deg);
        if (deg === 0) next.push(neighbor);
      }

      if (next.length > 0) {
        ready.push(...next);
        ready.sort(bySeq);
      }
    }

    if (result.length !== entries.length) {
      const remaining: string[] = entries
        .filter((e: Entry) => !result.includes(e))
        .map((e: Entry) => e.name);
      throw new SchedulerCycleError(this.lane, stage.name, remaining);
    }

    return result;
  }

  private assertSameStage(
    stage: Stage,
    entry: Entry,
    target: string,
    byName: Map<string, Entry>,
    kind: "before" | "after",
  ): void {
    if (!byName.has(target)) {
      throw new Error(
        `Step "${entry.name}" (lane "${this.lane}", stage "${stage.name}") ` +
          `declares ${kind} "${target}", which is not a step in the same stage. ` +
          `Cross-stage ordering constraints are not allowed; use stage order instead.`,
      );
    }
  }
}

export class Scheduler {
  public readonly fixed: LaneScheduler;
  public readonly update: LaneScheduler;
  public readonly render: LaneScheduler;

  private readonly logger: Logger;
  private readonly lanes: Record<Lane, LaneSchedulerImpl>;

  public constructor() {
    this.logger = createLogger(Scheduler.name);
    this.lanes = {
      fixed: new LaneSchedulerImpl("fixed", this.logger),
      update: new LaneSchedulerImpl("update", this.logger),
      render: new LaneSchedulerImpl("render", this.logger),
    };
    this.fixed = this.lanes.fixed;
    this.update = this.lanes.update;
    this.render = this.lanes.render;
  }

  public createSet(name: string): StepSet {
    return new StepSetImpl(name, this.lanes);
  }

  public runLane(lane: Lane, ctx: StepContext): void {
    this.lanes[lane].run(ctx);
  }

  // -------------------------------------------------------------------------
  // Legacy facade — preserved so existing plugins keep working during
  // migration. Removed in the final phase.
  // -------------------------------------------------------------------------

  /** @deprecated Use `scheduler.update.add(fn, spec)`. */
  public onUpdate(fn: LegacyStepFn, opts: StepOptions): void {
    this.lanes.update.addLegacy(fn, opts);
  }

  /** @deprecated Use `scheduler.fixed.add(fn, spec)`. */
  public onFixedUpdate(fn: LegacyStepFn, opts: StepOptions): void {
    this.lanes.fixed.addLegacy(fn, opts);
  }

  /** @deprecated Use `scheduler.render.add(fn, spec)`. */
  public onRender(fn: LegacyStepFn, opts: StepOptions): void {
    this.lanes.render.addLegacy(fn, opts);
  }

  /** @deprecated Use `runLane("update", ctx)`. */
  public runUpdate(dt: number): void {
    this.lanes.update.run(this.legacyCtx(dt));
  }

  /** @deprecated Use `runLane("fixed", ctx)`. */
  public runFixedUpdate(dt: number): void {
    this.lanes.fixed.run(this.legacyCtx(dt));
  }

  /** @deprecated Use `runLane("render", ctx)`. */
  public runRender(dt: number): void {
    this.lanes.render.run(this.legacyCtx(dt));
  }

  private legacyCtx(dt: number): StepContext {
    return { dt, alpha: 1, tick: 0, frame: 0, elapsed: 0 };
  }
}

class StepSetImpl implements StepSet {
  public readonly name: string;

  private readonly lanes: Record<Lane, LaneSchedulerImpl>;
  private handles: StepHandle[];

  public constructor(name: string, lanes: Record<Lane, LaneSchedulerImpl>) {
    this.name = name;
    this.lanes = lanes;
    this.handles = [];
  }

  public add(lane: Lane, fn: StepFn, spec: StepSpec): StepHandle {
    const handle: StepHandle = this.lanes[lane].add(fn, spec, this.name);
    this.handles.push(handle);
    return handle;
  }

  public enable(): void {
    for (const handle of this.handles) handle.setEnabled(true);
  }

  public disable(): void {
    for (const handle of this.handles) handle.setEnabled(false);
  }

  public remove(): void {
    for (const handle of this.handles) handle.remove();
    this.handles = [];
  }
}
