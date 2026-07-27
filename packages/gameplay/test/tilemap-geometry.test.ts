import { describe, expect, it } from "vitest";
import { Bound, Mat3, Transform2D, Vec2 } from "@atlasjs/math";
import {
  cellOrigin,
  visibleCellRange,
  worldBoundToLocalBound,
} from "../src/systems/utils/tilemap-geometry";

describe("cellOrigin", () => {
  it("computes the min-corner origin including the gap", () => {
    const origin = cellOrigin(new Vec2(128, 128), new Vec2(0, 0), 2, 3);
    expect(origin.x).toBe(256);
    expect(origin.y).toBe(384);

    const gapped = cellOrigin(new Vec2(16, 16), new Vec2(2, 4), 3, 2);
    expect(gapped.x).toBe(54);
    expect(gapped.y).toBe(40);
  });
});

describe("visibleCellRange", () => {
  it("returns the inclusive cell range overlapping a local bound", () => {
    const range = visibleCellRange(
      new Vec2(128, 128),
      new Vec2(0, 0),
      new Bound(200, 0, 300, 100),
    );
    expect(range.cxMin).toBe(1);
    expect(range.cxMax).toBe(3);
    expect(range.cyMin).toBe(0);
    expect(range.cyMax).toBe(0);
  });
});

describe("worldBoundToLocalBound", () => {
  it("is identity for an identity matrix", () => {
    const local: Bound = worldBoundToLocalBound(
      Mat3.identity(),
      new Bound(10, 20, 30, 40),
    );
    expect(local.x).toBeCloseTo(10, 4);
    expect(local.y).toBeCloseTo(20, 4);
    expect(local.width).toBeCloseTo(30, 4);
    expect(local.height).toBeCloseTo(40, 4);
  });

  it("undoes a world translation", () => {
    const world: Mat3 = new Mat3().fromTransform2D(new Transform2D(new Vec2(100, 50)));
    const inv: Mat3 = world.clone().invert();

    const local: Bound = worldBoundToLocalBound(inv, new Bound(100, 50, 20, 20));
    expect(local.x).toBeCloseTo(0, 4);
    expect(local.y).toBeCloseTo(0, 4);
  });
});
