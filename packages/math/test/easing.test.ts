import { describe, expect, it } from "vitest";
import { Easing } from "../src/Easing";
import { MathUtils } from "../src/MathUtils";

describe("MathUtils.lerp", () => {
  it("returns the bounds at t = 0 and t = 1", () => {
    expect(MathUtils.lerp(10, 20, 0)).toBe(10);
    expect(MathUtils.lerp(10, 20, 1)).toBe(20);
  });

  it("interpolates linearly in between", () => {
    expect(MathUtils.lerp(10, 20, 0.5)).toBe(15);
    expect(MathUtils.lerp(-4, 4, 0.25)).toBe(-2);
  });

  it("extrapolates outside [0, 1]", () => {
    expect(MathUtils.lerp(0, 10, 2)).toBe(20);
    expect(MathUtils.lerp(0, 10, -1)).toBe(-10);
  });
});

describe("Easing.inOutQuad", () => {
  it("is anchored at 0, 0.5 and 1", () => {
    expect(Easing.inOutQuad(0)).toBe(0);
    expect(Easing.inOutQuad(0.5)).toBeCloseTo(0.5);
    expect(Easing.inOutQuad(1)).toBe(1);
  });

  it("is symmetric around the midpoint", () => {
    for (let i = 1; i < 10; i++) {
      const t: number = i / 10;
      expect(Easing.inOutQuad(t)).toBeCloseTo(1 - Easing.inOutQuad(1 - t));
    }
  });

  it("starts slower than linear and ends faster", () => {
    expect(Easing.inOutQuad(0.25)).toBeLessThan(0.25);
    expect(Easing.inOutQuad(0.75)).toBeGreaterThan(0.75);
  });
});

describe("Easing.outCubic", () => {
  it("is anchored at 0 and 1", () => {
    expect(Easing.outCubic(0)).toBe(0);
    expect(Easing.outCubic(1)).toBe(1);
  });

  it("front-loads the progression", () => {
    expect(Easing.outCubic(0.25)).toBeGreaterThan(0.5);
    expect(Easing.outCubic(0.5)).toBeCloseTo(0.875);
  });

  it("stays monotonic over [0, 1]", () => {
    let previous: number = Easing.outCubic(0);

    for (let i = 1; i <= 20; i++) {
      const current: number = Easing.outCubic(i / 20);
      expect(current).toBeGreaterThan(previous);
      previous = current;
    }
  });
});
