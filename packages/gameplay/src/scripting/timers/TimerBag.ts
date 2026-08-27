import type {
  AdvancingTimer,
  Countdown,
  Repeater,
  Stopwatch,
  TimerHandle,
} from "./types";

import { CountdownTimer, RepeaterTimer, StopwatchTimer } from "./timers";

export class TimerBag {
  private readonly timers: AdvancingTimer[] = [];

  public stopwatch(): Stopwatch {
    const timer: StopwatchTimer = new StopwatchTimer();
    this.timers.push(timer);

    return timer;
  }

  public countdown(seconds: number): Countdown {
    const timer: CountdownTimer = new CountdownTimer(seconds);
    this.timers.push(timer);

    return timer;
  }

  public every(seconds: number, callback: () => void): Repeater {
    const timer: RepeaterTimer = new RepeaterTimer(seconds, callback);
    this.timers.push(timer);

    return timer;
  }

  public cancel(handle: TimerHandle): void {
    const index: number = this.timers.indexOf(handle as AdvancingTimer);

    if (index >= 0) {
      this.timers.splice(index, 1);
    }
  }

  public advance(dt: number): void {
    for (let i: number = 0; i < this.timers.length; i++) {
      this.timers[i].advance(dt);
    }
  }
}
