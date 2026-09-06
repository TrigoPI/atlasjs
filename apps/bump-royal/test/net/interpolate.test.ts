import { describe, expect, it } from "vitest";

import {
  alphaBetween,
  EXTRAPOLATE_MAX_TICKS,
  extrapolationTicks,
  lerp,
  lerpAngle,
  normalizeAngle,
  SECONDS_PER_TICK,
} from "../../src/net/interpolate";

const PI: number = Math.PI;

describe("lerp", () => {
  it("returns the ends untouched", () => {
    expect(lerp(10, 30, 0)).toBe(10);
    expect(lerp(10, 30, 1)).toBe(30);
  });

  it("walks linearly between them", () => {
    expect(lerp(10, 30, 0.25)).toBeCloseTo(15, 9);
  });
});

describe("normalizeAngle", () => {
  it("leaves an angle already inside the range alone", () => {
    expect(normalizeAngle(1)).toBeCloseTo(1, 9);
    expect(normalizeAngle(-1)).toBeCloseTo(-1, 9);
  });

  it("folds a full turn away in both directions", () => {
    expect(normalizeAngle(1 + 2 * PI)).toBeCloseTo(1, 9);
    expect(normalizeAngle(1 - 2 * PI)).toBeCloseTo(1, 9);
  });

  it("resolves the seam to +PI", () => {
    expect(normalizeAngle(PI)).toBeCloseTo(PI, 9);
    expect(normalizeAngle(-PI)).toBeCloseTo(PI, 9);
  });
});

describe("lerpAngle", () => {
  it("interpolates directly when the pair does not straddle the seam", () => {
    expect(lerpAngle(0, 1, 0.5)).toBeCloseTo(0.5, 9);
    expect(lerpAngle(-1, 1, 0.5)).toBeCloseTo(0, 9);
  });

  /* A naive lerp of 3.0 and -3.0 walks down through zero — a full half-turn the wrong way —
     and the eyes visibly spin every time a player faces left. */
  it("crosses +PI rather than sweeping back through zero", () => {
    const half: number = lerpAngle(3.0, -3.0, 0.5);

    expect(Math.abs(half)).toBeGreaterThan(3.0);
    expect(lerpAngle(3.0, -3.0, 0.25)).toBeCloseTo(3.0 + 0.2831853 * 0.25, 6);
  });

  it("crosses -PI in the other direction just as short", () => {
    const quarter: number = lerpAngle(-3.0, 3.0, 0.25);

    expect(quarter).toBeCloseTo(-3.0 - 0.2831853 * 0.25, 6);
  });

  it("is symmetric across the seam", () => {
    const forward: number = lerpAngle(3.0, -3.0, 0.5);
    const backward: number = lerpAngle(-3.0, 3.0, 0.5);

    expect(Math.abs(forward)).toBeCloseTo(Math.abs(backward), 6);
  });

  it("returns the ends untouched", () => {
    expect(lerpAngle(2.5, -2.5, 0)).toBeCloseTo(2.5, 9);
    expect(lerpAngle(2.5, -2.5, 1)).toBeCloseTo(-2.5, 9);
  });
});

describe("alphaBetween", () => {
  it("maps the tick onto the span", () => {
    expect(alphaBetween(30, 33, 31.5)).toBeCloseTo(0.5, 9);
  });

  it("clamps outside the span rather than running past the samples", () => {
    expect(alphaBetween(30, 33, 20)).toBe(0);
    expect(alphaBetween(30, 33, 40)).toBe(1);
  });

  it("collapses a non-positive span to zero", () => {
    expect(alphaBetween(30, 30, 30)).toBe(0);
    expect(alphaBetween(33, 30, 31)).toBe(0);
  });
});

describe("extrapolationTicks", () => {
  it("reports the elapsed ticks inside the cap", () => {
    expect(extrapolationTicks(30, 34.5)).toBeCloseTo(4.5, 9);
  });

  it("holds instead of running away past the cap", () => {
    expect(extrapolationTicks(30, 60)).toBe(EXTRAPOLATE_MAX_TICKS);
  });

  it("never walks backwards below the sample", () => {
    expect(extrapolationTicks(30, 24)).toBe(0);
  });

  it("caps a dash at roughly a sixth of the arena", () => {
    const dashSpeed: number = 700;
    const travelled: number =
      dashSpeed * EXTRAPOLATE_MAX_TICKS * SECONDS_PER_TICK;

    expect(travelled).toBeCloseTo(105, 6);
  });
});
