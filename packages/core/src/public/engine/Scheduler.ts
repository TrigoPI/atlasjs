import { STAGES_BY_LANE } from "./Stages";
import {
  Lane,
  LaneScheduler,
  Stage,
  StepContext,
  StepFn,
  StepHandle,
  StepSet,
  StepSpec,
} from "./types";

/** Small offset used to order steps within a stage on the shared axis. */
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
  stage: Stage;
  before: string[];
  after: string[];
};

function asArray(v: string | readonly string[] | undefined): string[] {
  if (v === undefined) return [];
  return typeof v === "string" ? [v] : [...v];
}

class LaneSchedulerImpl implements LaneScheduler {
  public readonly lane: Lane;

  private readonly stages: readonly Stage[];
  private readonly entries: Map<string, Entry>;

  private compiled: Entry[];
  private dirty: boolean;
  private seqCounter: number;

  public constructor(lane: Lane) {
    this.lane = lane;
    this.stages = STAGES_BY_LANE[lane];
    this.entries = new Map<string, Entry>();
    this.compiled = [];
    this.dirty = false;
    this.seqCounter = 0;
  }

  public add(fn: StepFn, spec: StepSpec, setName?: string): StepHandle {
    const stage: Stage | undefined = this.stages.find(
      (s: Stage) => s.name === spec.stage,
    );

    if (!stage) {
      const names: string = this.stages.map((s: Stage) => s.name).join(", ");
      throw new Error(
        `Unknown stage "${spec.stage}" for lane "${this.lane}". Valid stages: ${names}.`,
      );
    }

    const entry: Entry = {
      name: spec.name,
      fn,
      seq: this.seqCounter++,
      enabled: spec.enabled ?? true,
      setName,
      stage,
      before: asArray(spec.before),
      after: asArray(spec.after),
    };

    this.insert(entry);
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

  private compile(): void {
    const all: Entry[] = [...this.entries.values()];
    const keyed: { entry: Entry; key: number }[] = [];

    // Bucket by stage, topologically sort within each stage, then place each
    // step on the shared ordering axis by its stage anchor + within-stage rank.
    for (const stage of this.stages) {
      const inStage: Entry[] = all.filter(
        (e: Entry) => e.stage.name === stage.name,
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

  private readonly lanes: Record<Lane, LaneSchedulerImpl>;

  public constructor() {
    this.lanes = {
      fixed: new LaneSchedulerImpl("fixed"),
      update: new LaneSchedulerImpl("update"),
      render: new LaneSchedulerImpl("render"),
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
