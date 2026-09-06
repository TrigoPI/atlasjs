import { beforeEach, describe, expect, it } from "vitest";

import {
  MAX_BUFFERED_SNAPSHOTS,
  RENDER_DELAY_TICKS,
  SnapshotBuffer,
  type SnapshotBracket,
} from "../../src/net/SnapshotBuffer";
import {
  SNAPSHOT_INTERVAL_TICKS,
  TICK_HZ,
  toNetId,
} from "../../src/net/protocol";
import type { ServerSnapshot } from "../../src/net/protocol";

const START_TICK: number = 30;
const START_TIME: number = 10;

function snapshot(tick: number, x: number = 0): ServerSnapshot {
  return {
    k: "snap",
    t: tick,
    ack: 0,
    p: [{ id: toNetId(1), x, y: 0, vx: 0, vy: 0, a: 0, f: 0 }],
  };
}

function seconds(ticks: number): number {
  return ticks / TICK_HZ;
}

describe("SnapshotBuffer.push", () => {
  let buffer: SnapshotBuffer;

  beforeEach(() => {
    buffer = new SnapshotBuffer();
  });

  it("anchors the render clock on the first snapshot", () => {
    expect(buffer.hasAnchor).toBe(false);

    buffer.push(snapshot(START_TICK), START_TIME);

    expect(buffer.hasAnchor).toBe(true);
    expect(buffer.renderTick(START_TIME)).toBeCloseTo(
      START_TICK - RENDER_DELAY_TICKS,
      9,
    );
  });

  it("keeps an explicit anchor rather than re-anchoring on the first snapshot", () => {
    buffer.anchor(100, START_TIME);
    buffer.push(snapshot(START_TICK), START_TIME);

    expect(buffer.renderTick(START_TIME)).toBeCloseTo(
      100 - RENDER_DELAY_TICKS,
      9,
    );
  });

  it("accepts strictly newer snapshots", () => {
    expect(buffer.push(snapshot(START_TICK), START_TIME)).toBe(true);
    expect(buffer.push(snapshot(START_TICK + 3), START_TIME)).toBe(true);
    expect(buffer.size).toBe(2);
  });

  it("drops a duplicate and a straggler without disturbing the buffer", () => {
    buffer.push(snapshot(START_TICK), START_TIME);
    buffer.push(snapshot(START_TICK + 3), START_TIME);

    expect(buffer.push(snapshot(START_TICK + 3), START_TIME)).toBe(false);
    expect(buffer.push(snapshot(START_TICK), START_TIME)).toBe(false);
    expect(buffer.size).toBe(2);
    expect(buffer.newest()?.t).toBe(START_TICK + 3);
  });

  it("caps the buffer, dropping from the oldest end", () => {
    const extra: number = 8;

    for (let i: number = 0; i < MAX_BUFFERED_SNAPSHOTS + extra; i++) {
      buffer.push(snapshot(START_TICK + i * SNAPSHOT_INTERVAL_TICKS), 0);
    }

    expect(buffer.size).toBe(MAX_BUFFERED_SNAPSHOTS);
    expect(buffer.oldest()?.t).toBe(
      START_TICK + extra * SNAPSHOT_INTERVAL_TICKS,
    );
  });
});

describe("SnapshotBuffer.renderTick", () => {
  let buffer: SnapshotBuffer;

  beforeEach(() => {
    buffer = new SnapshotBuffer();
    buffer.push(snapshot(START_TICK), START_TIME);
  });

  it("starts one render delay behind the anchor", () => {
    expect(buffer.serverTick(START_TIME)).toBeCloseTo(START_TICK, 9);
    expect(buffer.renderTick(START_TIME)).toBeCloseTo(
      START_TICK - RENDER_DELAY_TICKS,
      9,
    );
  });

  it("advances one tick per 1/TICK_HZ of elapsed time", () => {
    expect(buffer.renderTick(START_TIME + seconds(6))).toBeCloseTo(
      START_TICK,
      9,
    );
    expect(buffer.renderTick(START_TIME + seconds(30))).toBeCloseTo(
      START_TICK + 24,
      9,
    );
  });

  it("keeps the delay at two snapshot intervals", () => {
    expect(RENDER_DELAY_TICKS).toBe(2 * SNAPSHOT_INTERVAL_TICKS);
  });
});

describe("SnapshotBuffer.bracket", () => {
  let buffer: SnapshotBuffer;

  beforeEach(() => {
    buffer = new SnapshotBuffer();
    buffer.push(snapshot(30, 0), START_TIME);
    buffer.push(snapshot(33, 10), START_TIME);
    buffer.push(snapshot(36, 20), START_TIME);
  });

  it("has nothing to offer while empty", () => {
    expect(new SnapshotBuffer().bracket(0)).toBeNull();
  });

  it("straddles a tick inside the buffer", () => {
    const bracket: SnapshotBracket | null = buffer.bracket(31.5);

    expect(bracket?.from.t).toBe(30);
    expect(bracket?.to?.t).toBe(33);
  });

  it("starts a pair exactly on a sample", () => {
    const bracket: SnapshotBracket | null = buffer.bracket(33);

    expect(bracket?.from.t).toBe(33);
    expect(bracket?.to?.t).toBe(36);
  });

  it("reports [newest, null] once the render clock runs past the end", () => {
    const onEnd: SnapshotBracket | null = buffer.bracket(36);
    const pastEnd: SnapshotBracket | null = buffer.bracket(41);

    expect(onEnd?.from.t).toBe(36);
    expect(onEnd?.to).toBeNull();
    expect(pastEnd?.from.t).toBe(36);
    expect(pastEnd?.to).toBeNull();
  });

  /* The first 100 ms after connecting: the render clock sits a delay behind the only sample
     held, and holding on the oldest is what the applier must do there. */
  it("holds on the oldest before the buffer starts", () => {
    const bracket: SnapshotBracket | null = buffer.bracket(24);

    expect(bracket?.from.t).toBe(30);
    expect(bracket?.to).toBeNull();
  });
});

describe("SnapshotBuffer.resync", () => {
  let buffer: SnapshotBuffer;

  beforeEach(() => {
    buffer = new SnapshotBuffer();
    buffer.push(snapshot(30), START_TIME);
    buffer.push(snapshot(33), START_TIME);
    buffer.push(snapshot(36), START_TIME);
  });

  it("keeps only the newest snapshot", () => {
    buffer.resync(START_TIME + 5);

    expect(buffer.size).toBe(1);
    expect(buffer.newest()?.t).toBe(36);
    expect(buffer.oldest()?.t).toBe(36);
  });

  it("re-anchors the render clock on it, so no stale frame is replayed", () => {
    const resumed: number = START_TIME + 5;

    buffer.resync(resumed);

    expect(buffer.renderTick(resumed)).toBeCloseTo(36 - RENDER_DELAY_TICKS, 9);
    expect(buffer.bracket(buffer.renderTick(resumed))?.from.t).toBe(36);
  });

  it("does nothing on an empty buffer", () => {
    const empty: SnapshotBuffer = new SnapshotBuffer();

    empty.resync(START_TIME);

    expect(empty.size).toBe(0);
    expect(empty.hasAnchor).toBe(false);
  });
});

describe("SnapshotBuffer.clear", () => {
  it("drops the samples and the anchor together", () => {
    const buffer: SnapshotBuffer = new SnapshotBuffer();

    buffer.push(snapshot(30), START_TIME);
    buffer.clear();

    expect(buffer.size).toBe(0);
    expect(buffer.hasAnchor).toBe(false);
    expect(buffer.bracket(30)).toBeNull();
  });
});
