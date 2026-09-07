import type { LoopFactory, StopLoop } from "@atlasjs/core";

export type TimerLoopOptions = {
  periodMs: number;
  maxDeltaMs: number;
  now?: () => number;
};

const MS_PER_SECOND: number = 1000;

export function createTimerLoop(options: TimerLoopOptions): LoopFactory {
  const periodMs: number = options.periodMs;
  const maxDeltaMs: number = options.maxDeltaMs;
  const now: () => number = options.now ?? ((): number => performance.now());

  return (onTick: (dt: number) => void): StopLoop => {
    let running: boolean = true;
    let timer: ReturnType<typeof setTimeout> | null = null;
    let last: number = now();
    let next: number = last + periodMs;

    const step = (): void => {
      if (!running) {
        return;
      }

      const current: number = now();
      const elapsed: number = current - last;
      last = current;

      next += periodMs;

      /* Strictly more than a whole period behind (GC pause, blocking I/O): drop the debt.
         Re-arming at zero delay instead would fire a catch-up burst that starves the event
         loop, and the transport lives on that same loop. */
      if (next < current) {
        next = current + periodMs;
      }

      /* Engine.advanceFixed caps the sub-steps it runs per frame but leaves the leftover
         time in its accumulator, which is private. An unclamped dt after a stall therefore
         buys ticks of debt that get paid several per frame while the wall clock adds one —
         tick number and wall clock diverge for the whole catch-up. Clamp here instead. */
      onTick(Math.min(elapsed, maxDeltaMs) / MS_PER_SECOND);

      if (!running) {
        return;
      }

      timer = setTimeout(step, Math.max(0, next - now()));
    };

    timer = setTimeout(step, periodMs);

    return (): void => {
      running = false;

      if (timer !== null) {
        clearTimeout(timer);
        timer = null;
      }
    };
  };
}
