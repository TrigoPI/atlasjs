import { describe, expect, it } from "vitest";

import {
  MAX_PENDING_EVENTS,
  NetEventQueue,
} from "../../src/client/NetEventQueue";
import { toNetId } from "../../src/net/protocol";
import type { BumpEvent, ServerEvent } from "../../src/net/protocol";

function bump(tick: number): BumpEvent {
  return {
    k: "bump",
    t: tick,
    a: toNetId(1),
    b: toNetId(2),
    px: tick,
    py: 0,
    s: 100,
  };
}

function drainAt(queue: NetEventQueue, renderTick: number): ServerEvent[] {
  const applied: ServerEvent[] = [];

  queue.drain(renderTick, (event: ServerEvent): void => {
    applied.push(event);
  });

  return applied;
}

describe("NetEventQueue", () => {
  /* The snapshot carrying an event is RENDER_DELAY_TICKS ahead of what is on screen. Applying on
     arrival would squish both discs a tenth of a second before the sprites visibly touch. */
  it("holds an event until the render clock reaches its tick", () => {
    const queue: NetEventQueue = new NetEventQueue();
    queue.push([bump(120)]);

    expect(drainAt(queue, 119)).toEqual([]);
    expect(queue.size).toBe(1);
    expect(drainAt(queue, 119.99)).toEqual([]);

    expect(drainAt(queue, 120)).toEqual([bump(120)]);
    expect(queue.size).toBe(0);
  });

  it("releases in tick order and stops at the first event still in the future", () => {
    const queue: NetEventQueue = new NetEventQueue();

    queue.push([bump(100), bump(101)]);
    queue.push([bump(103), bump(106)]);

    const applied: ServerEvent[] = drainAt(queue, 103);

    expect(applied.map((e: ServerEvent): number => e.t)).toEqual([
      100, 101, 103,
    ]);

    expect(queue.peek()?.t).toBe(106);
  });

  it("never replays an event a later frame walks over again", () => {
    const queue: NetEventQueue = new NetEventQueue();
    queue.push([bump(100), bump(101)]);

    expect(drainAt(queue, 101)).toHaveLength(2);
    expect(drainAt(queue, 200)).toEqual([]);
    expect(drainAt(queue, 101)).toEqual([]);
    expect(queue.size).toBe(0);
  });

  it("drops the oldest rather than growing without bound when the clock stalls", () => {
    const queue: NetEventQueue = new NetEventQueue();

    for (let i: number = 0; i < MAX_PENDING_EVENTS + 10; i++) {
      queue.push([bump(i)]);
    }

    expect(queue.size).toBe(MAX_PENDING_EVENTS);
    expect(queue.peek()?.t).toBe(10);
  });

  /* resync drops all but the newest snapshot and re-anchors the clock on it, so everything still
     pending would come due in one frame — a burst of squishes for bumps the hidden tab missed. */
  it("forgets everything pending on clear", () => {
    const queue: NetEventQueue = new NetEventQueue();

    queue.push([bump(100), bump(101)]);
    queue.clear();

    expect(queue.size).toBe(0);
    expect(drainAt(queue, 500)).toEqual([]);
  });
});
