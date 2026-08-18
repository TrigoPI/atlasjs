import { describe, expect, it } from "vitest";
import { PI, PI_2 } from "../src/Math";
import { Vec2 } from "../src/Vec2";

describe("Vec2.angle", () => {
  it("returns 0 for +X", () => {
    expect(new Vec2(1, 0).angle()).toBe(0);
  });

  it("returns PI/2 for +Y", () => {
    expect(new Vec2(0, 1).angle()).toBeCloseTo(PI / 2);
  });

  it("returns PI for -X", () => {
    expect(new Vec2(-1, 0).angle()).toBeCloseTo(PI);
  });

  it("returns 3PI/2 for -Y instead of -PI/2", () => {
    expect(new Vec2(0, -1).angle()).toBeCloseTo((3 * PI) / 2);
  });

  it("stays in [0, 2PI[ for every direction", () => {
    for (let i = 0; i < 720; i++) {
      const r: number = (i * PI) / 360;
      const a: number = Vec2.fromAngle(r).angle();
      expect(a).toBeGreaterThanOrEqual(0);
      expect(a).toBeLessThan(PI_2);
    }
  });

  it("normalizes the static two-point form", () => {
    const a: Vec2 = new Vec2(5, 5);
    const b: Vec2 = new Vec2(4, 4);
    expect(Vec2.angle(a, b)).toBeCloseTo((5 * PI) / 4);
  });
});
