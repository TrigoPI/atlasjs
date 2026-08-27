import type { AdvancingTimer, Countdown, Repeater, Stopwatch } from "./types";

export class StopwatchTimer implements Stopwatch, AdvancingTimer {
  private accumulated: number = 0;

  public get elapsed(): number {
    return this.accumulated;
  }

  public advance(dt: number): void {
    this.accumulated += dt;
  }

  public reset(): void {
    this.accumulated = 0;
  }
}

export class CountdownTimer implements Countdown, AdvancingTimer {
  private readonly initial: number;

  private left: number;
  private spent: number;

  public constructor(seconds: number) {
    this.initial = seconds > 0 ? seconds : 0;
    this.left = this.initial;
    this.spent = 0;
  }

  public get remaining(): number {
    return this.left;
  }

  public get elapsed(): number {
    return this.spent;
  }

  public get done(): boolean {
    return this.left <= 0;
  }

  public advance(dt: number): void {
    this.spent += dt;
    this.left = Math.max(0, this.left - dt);
  }

  public reset(seconds?: number): void {
    this.left =
      seconds === undefined ? this.initial : seconds > 0 ? seconds : 0;
    this.spent = 0;
  }
}

export class RepeaterTimer implements Repeater, AdvancingTimer {
  private readonly callback: () => void;

  private accumulated: number = 0;

  public interval: number;

  public constructor(seconds: number, callback: () => void) {
    this.interval = seconds;
    this.callback = callback;
  }

  public advance(dt: number): void {
    this.accumulated += dt;

    if (!(this.interval > 0) || !(this.accumulated >= this.interval)) {
      return;
    }

    this.accumulated = Math.min(
      this.accumulated - this.interval,
      this.interval,
    );
    this.callback();
  }

  public reset(): void {
    this.accumulated = 0;
  }
}
