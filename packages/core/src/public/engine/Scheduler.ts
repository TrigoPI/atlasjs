import { StepFn } from "./types";

export class Scheduler {
  private readonly updates: StepFn[];
  private readonly fixed: StepFn[];
  private readonly renders: StepFn[];

  public constructor() {
    this.updates = [];
    this.fixed = [];
    this.renders = [];
  }

  public onUpdate(fn: StepFn): void {
    this.updates.push(fn);
  }

  public onFixedUpdate(fn: StepFn): void {
    this.fixed.push(fn);
  }

  public onRender(fn: StepFn): void {
    this.renders.push(fn);
  }

  public runUpdate(dt: number): void {
    for (const f of this.updates) {
      f(dt);
    }
  }

  public runFixedUpdate(dt: number): void {
    for (const f of this.fixed) {
      f(dt);
    }
  }

  public runRender(dt: number): void {
    for (const f of this.renders) {
      f(dt);
    }
  }
}
