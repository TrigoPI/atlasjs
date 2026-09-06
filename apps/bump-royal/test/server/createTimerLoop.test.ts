import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { LoopFactory, StopLoop } from "@atlasjs/core";

import { createTimerLoop } from "../../src/server/createTimerLoop";

const PERIOD_MS: number = 1000 / 60;
const MAX_DELTA_MS: number = 5 * PERIOD_MS;

type Rig = {
  dts: number[];
  stop: StopLoop;
  setClock: (ms: number) => void;
  fire: () => void;
  lastDelay: () => number;
  delays: () => number[];
};

/* The clock is injected rather than faked so a tick can be made to fire LATE: vitest's fake
   timers run a callback at exactly its due time, which can never reproduce a GC pause. */
function createRig(): Rig {
  let clock: number = 0;
  const dts: number[] = [];

  const timeoutSpy = vi.spyOn(globalThis, "setTimeout");

  const loop: LoopFactory = createTimerLoop({
    periodMs: PERIOD_MS,
    maxDeltaMs: MAX_DELTA_MS,
    now: (): number => clock,
  });

  const stop: StopLoop = loop((dt: number): void => {
    dts.push(dt);
  });

  const delays = (): number[] =>
    timeoutSpy.mock.calls.map((call: unknown[]): number => Number(call[1]));

  return {
    dts,
    stop,
    setClock: (ms: number): void => {
      clock = ms;
    },
    fire: (): void => {
      vi.advanceTimersToNextTimer();
    },
    lastDelay: (): number => delays()[delays().length - 1],
    delays,
  };
}

describe("createTimerLoop", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it("schedules against an ideal timeline instead of re-arming a constant period", () => {
    const rig: Rig = createRig();

    expect(rig.lastDelay()).toBeCloseTo(PERIOD_MS, 6);

    rig.setClock(PERIOD_MS + 2);
    rig.fire();

    expect(rig.lastDelay()).toBeCloseTo(PERIOD_MS - 2, 6);

    rig.setClock(2 * PERIOD_MS + 2);
    rig.fire();

    expect(rig.lastDelay()).toBeCloseTo(PERIOD_MS - 2, 6);

    rig.stop();
  });

  it("emits the real elapsed time, not the nominal period", () => {
    const rig: Rig = createRig();

    rig.setClock(PERIOD_MS + 2);
    rig.fire();

    expect(rig.dts).toEqual([(PERIOD_MS + 2) / 1000]);

    rig.stop();
  });

  it("resyncs to now after a stall instead of firing a catch-up burst", () => {
    const rig: Rig = createRig();

    rig.setClock(PERIOD_MS);
    rig.fire();

    rig.setClock(PERIOD_MS + 200);
    rig.fire();

    expect(rig.dts).toHaveLength(2);
    expect(rig.lastDelay()).toBeCloseTo(PERIOD_MS, 6);

    rig.setClock(PERIOD_MS + 200 + PERIOD_MS);
    rig.fire();

    expect(rig.dts).toHaveLength(3);
    expect(rig.lastDelay()).toBeCloseTo(PERIOD_MS, 6);

    rig.stop();
  });

  it("clamps the emitted dt to maxDeltaMs so no tick debt survives the stall", () => {
    const rig: Rig = createRig();

    rig.setClock(PERIOD_MS);
    rig.fire();

    rig.setClock(PERIOD_MS + 200);
    rig.fire();

    expect(rig.dts[1]).toBeCloseTo(MAX_DELTA_MS / 1000, 10);
    expect(rig.dts[1]).toBeLessThan(0.2);

    rig.stop();
  });

  it("stops firing once the returned StopLoop is called", () => {
    const rig: Rig = createRig();

    rig.setClock(PERIOD_MS);
    rig.fire();
    rig.stop();

    vi.advanceTimersByTime(10 * PERIOD_MS);

    expect(rig.dts).toHaveLength(1);
  });
});
