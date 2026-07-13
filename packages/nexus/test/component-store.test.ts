import { describe, expect, it } from "vitest";

import { IComponentStore, SparseSetStore } from "../src/ComponentStore";
import { Entity } from "../src/nexus-types";

const e = (n: number): Entity => n as Entity;

describe("SparseSetStore version", () => {
  it("starts at zero", () => {
    const store: IComponentStore<number> = new SparseSetStore();
    expect(store.version).toBe(0);
  });

  it("bumps when an entity is added", () => {
    const store: IComponentStore<number> = new SparseSetStore();

    store.set(e(1), 10);
    expect(store.version).toBe(1);

    store.set(e(2), 20);
    expect(store.version).toBe(2);
  });

  it("does not bump when overwriting an existing entity", () => {
    const store: IComponentStore<number> = new SparseSetStore();

    store.set(e(1), 10);
    const afterInsert: number = store.version;

    store.set(e(1), 99); // overwrite, not structural
    expect(store.version).toBe(afterInsert);
    expect(store.get(e(1))).toBe(99);
  });

  it("bumps when an entity is removed, but not on a no-op delete", () => {
    const store: IComponentStore<number> = new SparseSetStore();
    store.set(e(1), 10);
    const afterInsert: number = store.version;

    expect(store.delete(e(1))).toBe(true);
    expect(store.version).toBe(afterInsert + 1);

    expect(store.delete(e(1))).toBe(false); // already gone
    expect(store.version).toBe(afterInsert + 1);
  });
});
