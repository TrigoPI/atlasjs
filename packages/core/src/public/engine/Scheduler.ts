import { StepFn } from "./types";

export class Scheduler {
  private readonly updates: StepFn[];
  private readonly fixed: StepFn[];
  private readonly renders: StepFn[];
  private readonly endFrame: StepFn[];

  public constructor() {
    this.updates = [];
    this.fixed = [];
    this.renders = [];
    this.endFrame = [];
  }

  public onEndFrame(fn: StepFn): void {
    this.endFrame.push(fn);
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
    for (let i: number = 0; i < this.fixed.length; i++) {
      this.fixed[i](dt);
    }
  }

  public runRender(dt: number): void {
    for (let i: number = 0; i < this.renders.length; i++) {
      this.renders[i](dt);
    }
  }

  public runEndFrame(dt: number): void {
    for (let i: number = 0; i < this.endFrame.length; i++) {
      this.endFrame[i](dt);
    }
  }
}
