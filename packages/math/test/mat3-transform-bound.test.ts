import { describe, expect, it } from "vitest";

import { Bound } from "../src/Bound";
import { Mat3 } from "../src/Mat3";
import { Transform2D } from "../src/Transform2D";
import { Vec2 } from "../src/Vec2";

describe("Mat3.transformBound", () => {
  it("is the identity for an identity matrix", () => {
    const out: Bound = new Bound();
    Mat3.identity().transformBound(new Bound(10, 20, 30, 40), out);

    expect(out.x).toBeCloseTo(10, 6);
    expect(out.y).toBeCloseTo(20, 6);
    expect(out.width).toBeCloseTo(30, 6);
    expect(out.height).toBeCloseTo(40, 6);
  });

  it("offsets the bound under a pure translation and keeps its extents", () => {
    const m: Mat3 = Mat3.fromTransform2D(new Transform2D(new Vec2(100, -50)));
    const out: Bound = new Bound();

    m.transformBound(new Bound(10, 20, 30, 40), out);

    expect(out.x).toBeCloseTo(110, 6);
    expect(out.y).toBeCloseTo(-30, 6);
    expect(out.width).toBeCloseTo(30, 6);
    expect(out.height).toBeCloseTo(40, 6);
  });

  it("takes the min/max of the rotated corners, not of the original ones", () => {
    const m: Mat3 = Mat3.fromTransform2D(
      new Transform2D(new Vec2(0, 0), new Vec2(1, 1), Math.PI / 2),
    );
    const out: Bound = new Bound();

    m.transformBound(new Bound(1, 0, 2, 1), out);

    expect(out.x).toBeCloseTo(-1, 6);
    expect(out.y).toBeCloseTo(1, 6);
    expect(out.width).toBeCloseTo(1, 6);
    expect(out.height).toBeCloseTo(2, 6);
  });

  it("keeps a positive extent when a negative scale swaps the corners", () => {
    const m: Mat3 = Mat3.fromTransform2D(
      new Transform2D(new Vec2(0, 0), new Vec2(-1, -2), 0),
    );
    const out: Bound = new Bound();

    m.transformBound(new Bound(2, 1, 3, 4), out);

    expect(out.x).toBeCloseTo(-5, 6);
    expect(out.y).toBeCloseTo(-10, 6);
    expect(out.width).toBeCloseTo(3, 6);
    expect(out.height).toBeCloseTo(8, 6);
  });

  it("stays exact for a rotation that keeps the box axis-aligned", () => {
    const m: Mat3 = Mat3.fromTransform2D(
      new Transform2D(new Vec2(0, 0), new Vec2(1, 1), Math.PI),
    );
    const out: Bound = new Bound();

    m.transformBound(new Bound(1, 2, 3, 4), out);

    expect(out.x).toBeCloseTo(-4, 6);
    expect(out.y).toBeCloseTo(-6, 6);
    expect(out.width).toBeCloseTo(3, 6);
    expect(out.height).toBeCloseTo(4, 6);
  });

  it("writes into the provided out and returns it without allocating", () => {
    const m: Mat3 = Mat3.fromTransform2D(new Transform2D(new Vec2(5, 5)));
    const out: Bound = new Bound();

    const first: Bound = m.transformBound(new Bound(0, 0, 1, 1), out);
    const second: Bound = m.transformBound(new Bound(2, 2, 1, 1), out);

    expect(first).toBe(out);
    expect(second).toBe(out);
    expect(out.x).toBeCloseTo(7, 6);
    expect(out.y).toBeCloseTo(7, 6);
  });

  it("leaves the source bound untouched", () => {
    const m: Mat3 = Mat3.fromTransform2D(
      new Transform2D(new Vec2(3, 4), new Vec2(2, 2), 0.3),
    );
    const source: Bound = new Bound(1, 2, 3, 4);

    m.transformBound(source, new Bound());

    expect(source.x).toBe(1);
    expect(source.y).toBe(2);
    expect(source.width).toBe(3);
    expect(source.height).toBe(4);
  });

  it("supports transforming a bound into itself", () => {
    const m: Mat3 = Mat3.fromTransform2D(new Transform2D(new Vec2(10, 10)));
    const bound: Bound = new Bound(1, 2, 3, 4);

    m.transformBound(bound, bound);

    expect(bound.x).toBeCloseTo(11, 6);
    expect(bound.y).toBeCloseTo(12, 6);
    expect(bound.width).toBeCloseTo(3, 6);
    expect(bound.height).toBeCloseTo(4, 6);
  });

  it("round-trips a bound through a matrix and its inverse", () => {
    const world: Mat3 = Mat3.fromTransform2D(
      new Transform2D(new Vec2(100, 50), new Vec2(2, 2), 0),
    );
    const inv: Mat3 = world.clone().invert();
    const out: Bound = new Bound();

    world.transformBound(new Bound(4, 6, 8, 10), out);
    inv.transformBound(out, out);

    expect(out.x).toBeCloseTo(4, 5);
    expect(out.y).toBeCloseTo(6, 5);
    expect(out.width).toBeCloseTo(8, 5);
    expect(out.height).toBeCloseTo(10, 5);
  });
});
