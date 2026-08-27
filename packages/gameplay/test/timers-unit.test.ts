import { describe, expect, it } from "vitest";

import {
  CountdownTimer,
  RepeaterTimer,
  StopwatchTimer,
} from "../src/scripting/timers";

describe("StopwatchTimer", () => {
  it("accumulates time", () => {
    const timer: StopwatchTimer = new StopwatchTimer();

    timer.advance(0.1);
    timer.advance(0.2);

    expect(timer.elapsed).toBeCloseTo(0.3, 10);
  });

  it("restarts from zero after reset", () => {
    const timer: StopwatchTimer = new StopwatchTimer();

    timer.advance(0.5);
    timer.reset();

    expect(timer.elapsed).toBe(0);
  });

  it("does not advance on a zero dt", () => {
    const timer: StopwatchTimer = new StopwatchTimer();

    timer.advance(0);

    expect(timer.elapsed).toBe(0);
  });
});

describe("CountdownTimer", () => {
  it("counts down and declares itself done at zero", () => {
    const timer: CountdownTimer = new CountdownTimer(0.3);

    expect(timer.done).toBe(false);

    timer.advance(0.2);

    expect(timer.remaining).toBeCloseTo(0.1, 10);
    expect(timer.done).toBe(false);

    timer.advance(0.2);

    expect(timer.done).toBe(true);
  });

  it("does not go below zero", () => {
    const timer: CountdownTimer = new CountdownTimer(0.1);

    timer.advance(10);

    expect(timer.remaining).toBe(0);
  });

  it("exposes the time elapsed since the last reset", () => {
    const timer: CountdownTimer = new CountdownTimer(0.5);

    timer.advance(0.2);

    expect(timer.elapsed).toBeCloseTo(0.2, 10);
  });

  it("reset with no argument resumes the original duration", () => {
    const timer: CountdownTimer = new CountdownTimer(0.5);

    timer.advance(10);
    timer.reset();

    expect(timer.remaining).toBe(0.5);
    expect(timer.done).toBe(false);
  });

  it("reset with an argument changes the duration", () => {
    const timer: CountdownTimer = new CountdownTimer(0.5);

    timer.reset(0.2);

    expect(timer.remaining).toBe(0.2);
  });

  it("a countdown created at zero is done immediately", () => {
    const timer: CountdownTimer = new CountdownTimer(0);

    expect(timer.done).toBe(true);
  });

  it("a negative duration is clamped to zero", () => {
    const timer: CountdownTimer = new CountdownTimer(-5);

    expect(timer.remaining).toBe(0);
    expect(timer.done).toBe(true);
  });

  it("a non-numeric duration is treated as zero rather than never finishing", () => {
    const timer: CountdownTimer = new CountdownTimer(NaN);

    expect(timer.done).toBe(true);
  });

  it("reset to a non-numeric duration does not resurrect the timer", () => {
    const timer: CountdownTimer = new CountdownTimer(1);

    timer.reset(NaN);

    expect(timer.done).toBe(true);
  });
});

describe("RepeaterTimer", () => {
  it("triggers the callback when the interval is reached", () => {
    let fired: number = 0;
    const timer: RepeaterTimer = new RepeaterTimer(0.1, (): void => {
      fired += 1;
    });

    timer.advance(0.05);

    expect(fired).toBe(0);

    timer.advance(0.06);

    expect(fired).toBe(1);
  });

  it("fires only once per advance, even on a long frame", () => {
    let fired: number = 0;
    const timer: RepeaterTimer = new RepeaterTimer(0.1, (): void => {
      fired += 1;
    });

    timer.advance(5);

    expect(fired).toBe(1);
  });

  it("keeps the remainder across frames", () => {
    let fired: number = 0;
    const timer: RepeaterTimer = new RepeaterTimer(0.1, (): void => {
      fired += 1;
    });

    timer.advance(0.15);

    expect(fired).toBe(1);

    timer.advance(0.06);

    expect(fired).toBe(2);
  });

  it("does not bank more than one interval of catch-up", () => {
    let fired: number = 0;
    const timer: RepeaterTimer = new RepeaterTimer(0.1, (): void => {
      fired += 1;
    });

    timer.advance(5);
    timer.advance(0);
    timer.advance(0);

    expect(fired).toBe(2);
  });

  it("picks up an interval changed on the fly", () => {
    let fired: number = 0;
    const timer: RepeaterTimer = new RepeaterTimer(1, (): void => {
      fired += 1;
    });

    timer.advance(0.2);
    timer.interval = 0.1;
    timer.advance(0);

    expect(fired).toBe(1);
  });

  it("reset puts the clock back to zero without firing", () => {
    let fired: number = 0;
    const timer: RepeaterTimer = new RepeaterTimer(0.1, (): void => {
      fired += 1;
    });

    timer.advance(0.09);
    timer.reset();
    timer.advance(0.05);

    expect(fired).toBe(0);
  });

  it("a zero or negative interval never fires", () => {
    let fired: number = 0;
    const timer: RepeaterTimer = new RepeaterTimer(0, (): void => {
      fired += 1;
    });

    timer.advance(1);

    expect(fired).toBe(0);
  });

  it("a non-numeric interval never fires", () => {
    let fired: number = 0;
    const timer: RepeaterTimer = new RepeaterTimer(NaN, (): void => {
      fired += 1;
    });

    timer.advance(1);

    expect(fired).toBe(0);
  });

  it("an interval made non-numeric after construction never fires", () => {
    let fired: number = 0;
    const timer: RepeaterTimer = new RepeaterTimer(0.5, (): void => {
      fired += 1;
    });

    timer.interval = NaN;
    timer.advance(1);

    expect(fired).toBe(0);
  });

  it("a single non-numeric dt does not turn the repeater into a per-frame callback", () => {
    let fired: number = 0;
    const timer: RepeaterTimer = new RepeaterTimer(0.5, (): void => {
      fired += 1;
    });

    timer.advance(NaN);
    timer.advance(0.016);
    timer.advance(0.016);

    expect(fired).toBe(0);
  });
});
