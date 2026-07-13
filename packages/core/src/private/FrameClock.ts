import { StepContext } from "../public/engine/types";

export class FrameClock {
  public tick: number;
  public frame: number;
  public elapsed: number;
  public acc: number;

  public constructor() {
    this.tick = 0;
    this.frame = 0;
    this.elapsed = 0;
    this.acc = 0;
  }

  public context(dt: number, alpha: number): StepContext {
    return {
      dt,
      alpha,
      tick: this.tick,
      frame: this.frame,
      elapsed: this.elapsed,
    };
  }
}
