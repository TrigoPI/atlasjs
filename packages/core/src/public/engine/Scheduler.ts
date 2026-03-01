import { createLogger, Logger } from "@atlasjs/utils";
import { Step, StepFn, StepOptions } from "./types";

export class Scheduler {
  private readonly logger: Logger;

  private readonly updates: Step[];
  private readonly fixed: Step[];
  private readonly renders: Step[];

  public constructor() {
    this.logger = createLogger(Scheduler.name);
    this.updates = [];
    this.fixed = [];
    this.renders = [];
  }

  public onUpdate(fn: StepFn, opts: StepOptions): void {
    this.add(fn, this.updates, opts);
  }

  public onFixedUpdate(fn: StepFn, opts: StepOptions): void {
    this.add(fn, this.fixed, opts);
  }

  public onRender(fn: StepFn, opts: StepOptions): void {
    this.add(fn, this.renders, opts);
  }

  public runUpdate(dt: number): void {
    for (let i: number = 0; i < this.updates.length; i++) {
      this.updates[i].fn(dt);
    }
  }

  public runFixedUpdate(dt: number): void {
    for (let i: number = 0; i < this.fixed.length; i++) {
      this.fixed[i].fn(dt);
    }
  }

  public runRender(dt: number): void {
    for (let i: number = 0; i < this.renders.length; i++) {
      this.renders[i].fn(dt);
    }
  }

  private add(fn: StepFn, pool: Step[], opts: StepOptions): void {
    const id: number = opts.id ?? 0;
    const priority: number = opts.priority + id;
    const name: string = opts.name;

    this.logger.log(`Registering update step : ${opts.name}:${priority}`);

    pool.push({ fn, priority, name });
    this.sortStable(pool);
  }

  private sortStable(list: Step[]): void {
    list.sort((a: Step, b: Step) => a.priority - b.priority);
  }
}
