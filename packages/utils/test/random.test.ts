import { describe, expect, it } from "vitest";

import { randomRange, pickRandom } from "../src/random";

describe("randomRange", () => {
  it("returns min when rng yields 0", () => {
    expect(randomRange(2, 8, () => 0)).toBe(2);
  });

  it("approaches max as rng approaches 1", () => {
    expect(randomRange(2, 8, () => 0.9999)).toBeCloseTo(8, 2);
  });

  it("interpolates linearly for a mid rng value", () => {
    expect(randomRange(0, 10, () => 0.5)).toBe(5);
  });

  it("defaults rng to Math.random and stays within [min, max)", () => {
    for (let i = 0; i < 100; i++) {
      const value: number = randomRange(1, 3);
      expect(value).toBeGreaterThanOrEqual(1);
      expect(value).toBeLessThan(3);
    }
  });
});

describe("pickRandom", () => {
  it("picks the element at floor(rng * length)", () => {
    const items: readonly string[] = ["a", "b", "c", "d"];
    expect(pickRandom(items, () => 0)).toBe("a");
    expect(pickRandom(items, () => 0.5)).toBe("c");
    expect(pickRandom(items, () => 0.9999)).toBe("d");
  });

  it("throws on an empty array", () => {
    expect(() => pickRandom([], () => 0)).toThrow();
  });

  it("defaults rng to Math.random and returns a member of the array", () => {
    const items: readonly number[] = [10, 20, 30];
    for (let i = 0; i < 100; i++) {
      expect(items).toContain(pickRandom(items));
    }
  });
});
