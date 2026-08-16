import { describe, expect, it } from "vitest";
import { Vec2 } from "@atlasjs/math";

import { orbitBase } from "../../../src/game/scripts/orbit";

describe("orbitBase", () => {
  it("places the base at anchor + r along the initial angle", () => {
    const base: Vec2 = orbitBase(new Vec2(0, 0), 10, 0, 0, 0);
    expect(base.x).toBeCloseTo(10);
    expect(base.y).toBeCloseTo(0);
  });

  it("is relative to the anchor", () => {
    const base: Vec2 = orbitBase(new Vec2(5, 5), 10, 0, 0, 0);
    expect(base.x).toBeCloseTo(15);
    expect(base.y).toBeCloseTo(5);
  });

  it("advances the angle with angularSpeed over time", () => {
    const base: Vec2 = orbitBase(new Vec2(0, 0), 10, 0, Math.PI / 2, 1);
    expect(base.x).toBeCloseTo(0);
    expect(base.y).toBeCloseTo(10);
  });

  it("does not mutate the anchor vector", () => {
    const anchor: Vec2 = new Vec2(3, 7);
    orbitBase(anchor, 10, 1.2, 0.5, 2);
    expect(anchor.x).toBe(3);
    expect(anchor.y).toBe(7);
  });
});
