import { describe, expect, it } from "vitest";

import { Entity, SparseSet } from "../src";

const e = (n: number): Entity => n as Entity;

describe("SparseSet", () => {
  it("sets, gets and reports presence", () => {
    const set: SparseSet<string> = new SparseSet();

    set.set(e(3), "three");
    set.set(e(7), "seven");

    expect(set.size).toBe(2);
    expect(set.has(e(3))).toBe(true);
    expect(set.has(e(7))).toBe(true);
    expect(set.has(e(4))).toBe(false);
    expect(set.get(e(3))).toBe("three");
    expect(set.get(e(4))).toBeUndefined();
  });

  it("overwrites an existing entity without growing", () => {
    const set: SparseSet<string> = new SparseSet();

    set.set(e(3), "three");
    set.set(e(3), "THREE");

    expect(set.size).toBe(1);
    expect(set.get(e(3))).toBe("THREE");
  });

  it("swap-removes and keeps the surviving entries reachable", () => {
    const set: SparseSet<number> = new SparseSet();

    set.set(e(1), 10);
    set.set(e(2), 20);
    set.set(e(3), 30);

    expect(set.delete(e(1))).toBe(true);
    expect(set.size).toBe(2);
    expect(set.has(e(1))).toBe(false);

    // The last entry (e3) was swapped into e1's slot: it must still resolve.
    expect(set.get(e(3))).toBe(30);
    expect(set.get(e(2))).toBe(20);
  });

  it("returns false when deleting an absent entity", () => {
    const set: SparseSet<number> = new SparseSet();
    set.set(e(1), 10);

    expect(set.delete(e(2))).toBe(false);
    expect(set.size).toBe(1);
  });

  it("iterates entities and values consistently after removals", () => {
    const set: SparseSet<number> = new SparseSet();
    set.set(e(1), 10);
    set.set(e(2), 20);
    set.set(e(3), 30);
    set.delete(e(2));

    const entities: Entity[] = [...set.entities()];
    const values: number[] = [...set.values()];

    expect(new Set(entities)).toEqual(new Set([e(1), e(3)]));
    expect(new Set(values)).toEqual(new Set([10, 30]));
    for (const [entity, value] of set.entries()) {
      expect(set.get(entity)).toBe(value);
    }
  });
});
