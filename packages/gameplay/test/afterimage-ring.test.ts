import { describe, expect, it } from "vitest";
import type { Sprite } from "@atlasjs/nebula";

import {
  AfterimageRing,
  resolveAfterimageCapacity,
} from "../src/rendering/AfterimageRing";
import type { AfterimageSlot } from "../src/rendering/AfterimageRing";

const SPRITE: Sprite = {} as Sprite;

function stampX(ring: AfterimageRing, x: number): void {
  ring.stamp(SPRITE, x, 0, 0, 1, 1);
}

function aliveXs(ring: AfterimageRing): number[] {
  const out: number[] = [];

  for (let i: number = 0; i < ring.capacity; i++) {
    if (ring.isAlive(i)) {
      out.push(ring.at(i).x);
    }
  }

  return out;
}

function aliveAges(ring: AfterimageRing): number[] {
  const out: number[] = [];

  for (let i: number = 0; i < ring.capacity; i++) {
    if (ring.isAlive(i)) {
      out.push(ring.at(i).age);
    }
  }

  return out;
}

describe("resolveAfterimageCapacity", () => {
  it("clamps to at least one image", () => {
    expect(resolveAfterimageCapacity(0)).toBe(1);
    expect(resolveAfterimageCapacity(-12)).toBe(1);
  });

  it("clamps to at most 64 images", () => {
    expect(resolveAfterimageCapacity(65)).toBe(64);
    expect(resolveAfterimageCapacity(1_000)).toBe(64);
  });

  it("truncates towards zero", () => {
    expect(resolveAfterimageCapacity(3.9)).toBe(3);
    expect(resolveAfterimageCapacity(0.5)).toBe(1);
  });

  it("falls back to the minimum on NaN", () => {
    expect(resolveAfterimageCapacity(Number.NaN)).toBe(1);
  });
});

describe("AfterimageRing", () => {
  it("starts empty at the requested capacity", () => {
    const ring: AfterimageRing = new AfterimageRing(4);

    expect(ring.capacity).toBe(4);
    expect(ring.size).toBe(0);
    expect(aliveXs(ring)).toEqual([]);
  });

  it("stores the stamped state in a preallocated slot", () => {
    const ring: AfterimageRing = new AfterimageRing(2);
    ring.stamp(SPRITE, 10, 20, 0.5, -1, 2);

    const slot: AfterimageSlot = ring.at(0);

    expect(slot.sprite).toBe(SPRITE);
    expect(slot.x).toBe(10);
    expect(slot.y).toBe(20);
    expect(slot.rotation).toBe(0.5);
    expect(slot.scaleX).toBe(-1);
    expect(slot.scaleY).toBe(2);
    expect(slot.age).toBe(0);
    expect(ring.size).toBe(1);
  });

  it("grows up to capacity, oldest first", () => {
    const ring: AfterimageRing = new AfterimageRing(3);
    stampX(ring, 1);
    stampX(ring, 2);
    stampX(ring, 3);

    expect(ring.size).toBe(3);
    expect(aliveXs(ring)).toEqual([1, 2, 3]);
  });

  it("wraps around and drops the oldest entry once full", () => {
    const ring: AfterimageRing = new AfterimageRing(3);
    stampX(ring, 1);
    stampX(ring, 2);
    stampX(ring, 3);
    stampX(ring, 4);
    stampX(ring, 5);

    expect(ring.size).toBe(3);
    expect(aliveXs(ring).sort((a: number, b: number) => a - b)).toEqual([
      3, 4, 5,
    ]);
    expect(ring.at(0).x).toBe(4);
    expect(ring.at(1).x).toBe(5);
    expect(ring.at(2).x).toBe(3);
  });

  it("keeps liveness correct when the live window no longer starts at index 0", () => {
    const ring: AfterimageRing = new AfterimageRing(4);
    stampX(ring, 1);
    stampX(ring, 2);
    stampX(ring, 3);
    stampX(ring, 4);
    stampX(ring, 5);
    ring.advance(10, 1);

    expect(ring.size).toBe(0);

    stampX(ring, 6);
    stampX(ring, 7);

    expect(ring.size).toBe(2);
    expect(ring.isAlive(0)).toBe(false);
    expect(ring.isAlive(1)).toBe(true);
    expect(ring.isAlive(2)).toBe(true);
    expect(ring.isAlive(3)).toBe(false);
    expect(aliveXs(ring)).toEqual([6, 7]);
  });

  it("ages every live slot and leaves dead slots alone", () => {
    const ring: AfterimageRing = new AfterimageRing(3);
    stampX(ring, 1);
    ring.advance(0.25, 10);
    stampX(ring, 2);
    ring.advance(0.25, 10);

    expect(aliveAges(ring)).toEqual([0.5, 0.25]);
    expect(ring.at(2).age).toBe(0);
  });

  it("expires entries from the tail once they reach the max age", () => {
    const ring: AfterimageRing = new AfterimageRing(3);
    stampX(ring, 1);
    ring.advance(0.4, 1);
    stampX(ring, 2);
    ring.advance(0.4, 1);
    stampX(ring, 3);
    ring.advance(0.4, 1);

    expect(ring.size).toBe(2);
    expect(aliveXs(ring)).toEqual([2, 3]);

    ring.advance(0.4, 1);

    expect(ring.size).toBe(1);
    expect(aliveXs(ring)).toEqual([3]);
  });

  it("expires the whole buffer when every entry is older than the max age", () => {
    const ring: AfterimageRing = new AfterimageRing(4);
    stampX(ring, 1);
    stampX(ring, 2);
    stampX(ring, 3);
    ring.advance(5, 1);

    expect(ring.size).toBe(0);
    expect(aliveXs(ring)).toEqual([]);
  });

  it("expires from the tail even when the live window has wrapped", () => {
    const ring: AfterimageRing = new AfterimageRing(3);
    stampX(ring, 1);
    stampX(ring, 2);
    stampX(ring, 3);
    stampX(ring, 4);
    ring.advance(0.6, 1);
    stampX(ring, 5);
    ring.advance(0.6, 1);

    expect(ring.size).toBe(1);
    expect(aliveXs(ring)).toEqual([5]);
  });

  it("clears without touching the capacity", () => {
    const ring: AfterimageRing = new AfterimageRing(3);
    stampX(ring, 1);
    stampX(ring, 2);
    ring.clear();

    expect(ring.capacity).toBe(3);
    expect(ring.size).toBe(0);
    expect(aliveXs(ring)).toEqual([]);
  });

  it("restamps from index 0 after a clear", () => {
    const ring: AfterimageRing = new AfterimageRing(3);
    stampX(ring, 1);
    stampX(ring, 2);
    ring.clear();
    stampX(ring, 9);

    expect(ring.size).toBe(1);
    expect(ring.at(0).x).toBe(9);
    expect(ring.isAlive(0)).toBe(true);
  });

  it("empties the buffer when it grows", () => {
    const ring: AfterimageRing = new AfterimageRing(2);
    stampX(ring, 1);
    stampX(ring, 2);
    ring.resize(5);

    expect(ring.capacity).toBe(5);
    expect(ring.size).toBe(0);
  });

  it("empties the buffer when it shrinks", () => {
    const ring: AfterimageRing = new AfterimageRing(5);
    stampX(ring, 1);
    stampX(ring, 2);
    stampX(ring, 3);
    ring.resize(2);

    expect(ring.capacity).toBe(2);
    expect(ring.size).toBe(0);
    expect(aliveXs(ring)).toEqual([]);
  });

  it("keeps the buffer intact when resized to the same capacity", () => {
    const ring: AfterimageRing = new AfterimageRing(3);
    stampX(ring, 1);
    stampX(ring, 2);
    ring.resize(3);

    expect(ring.size).toBe(2);
    expect(aliveXs(ring)).toEqual([1, 2]);
  });

  it("stays usable at a capacity of one", () => {
    const ring: AfterimageRing = new AfterimageRing(1);
    stampX(ring, 1);

    expect(ring.size).toBe(1);
    expect(ring.isAlive(0)).toBe(true);

    stampX(ring, 2);

    expect(ring.size).toBe(1);
    expect(ring.at(0).x).toBe(2);

    ring.advance(2, 1);

    expect(ring.size).toBe(0);
    expect(ring.isAlive(0)).toBe(false);
  });

  it("reuses the same slot objects across stamps", () => {
    const ring: AfterimageRing = new AfterimageRing(2);
    const first: AfterimageSlot = ring.at(0);
    stampX(ring, 1);
    stampX(ring, 2);
    stampX(ring, 3);

    expect(ring.at(0)).toBe(first);
  });
});
