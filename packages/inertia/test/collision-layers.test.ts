import { describe, expect, it } from "vitest";

import { defineCollisionLayers } from "../src/CollisionLayers";

describe("defineCollisionLayers", () => {
  it("assigns one distinct bit per layer, in order", () => {
    const layers = defineCollisionLayers("Player", "Wall", "Enemy");
    expect(layers.Player).toBe(1);
    expect(layers.Wall).toBe(2);
    expect(layers.Enemy).toBe(4);
  });

  it("layers combine with bitwise OR into a mask", () => {
    const layers = defineCollisionLayers("A", "B", "C");
    expect(layers.A | layers.C).toBe(5);
  });

  it("throws beyond 16 layers", () => {
    const names = Array.from({ length: 17 }, (_, i) => `L${i}`);
    expect(() => defineCollisionLayers(...names)).toThrow();
  });
});
