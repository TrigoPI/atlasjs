export interface TimerHandle {
  reset(): void;
}

export interface AdvancingTimer extends TimerHandle {
  advance(dt: number): void;
}

export interface Stopwatch extends TimerHandle {
  readonly elapsed: number;
}

export interface Countdown extends TimerHandle {
  readonly remaining: number;
  readonly elapsed: number;
  readonly done: boolean;
  reset(seconds?: number): void;
}

export interface Repeater extends TimerHandle {
  interval: number;
}
