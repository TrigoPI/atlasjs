import { describe, expect, it } from "vitest";
import { Vec2 } from "@atlasjs/math";

import {
  ARENA_BOUNDS,
  ARENA_SCALE,
  isInsideArena,
  type ArenaBounds,
} from "../../../src/game/arena/bounds";

const HALF_WIDTH: number = ARENA_BOUNDS.halfWidth;
const DIAGONAL_EXTENT: number = ARENA_BOUNDS.diagonalExtent;
const CUT: number = DIAGONAL_EXTENT - HALF_WIDTH;

const onDiagonal = (sum: number): Vec2 => Vec2.create(sum / 2, sum / 2);

describe("arena geometry constants", () => {
  it("is a 330px half-width square cut by a 469.5px diamond", () => {
    expect(ARENA_SCALE).toBe(3);
    expect(HALF_WIDTH).toBe(330);
    expect(DIAGONAL_EXTENT).toBe(469.5);
  });

  it("cuts the corners: the diamond is tighter than the square's diagonal", () => {
    expect(DIAGONAL_EXTENT).toBeLessThan(2 * HALF_WIDTH);
    expect(CUT).toBe(139.5);
  });
});

describe("isInsideArena without margin", () => {
  it("accepts the centre", () => {
    expect(isInsideArena(ARENA_BOUNDS, Vec2.create(0, 0))).toBe(true);
  });

  it("rejects a point well outside", () => {
    expect(isInsideArena(ARENA_BOUNDS, Vec2.create(10 * HALF_WIDTH, 0))).toBe(
      false,
    );
    expect(isInsideArena(ARENA_BOUNDS, Vec2.create(0, -10 * HALF_WIDTH))).toBe(
      false,
    );
  });

  it("treats the square edge as inclusive", () => {
    expect(isInsideArena(ARENA_BOUNDS, Vec2.create(HALF_WIDTH, 0))).toBe(true);
    expect(isInsideArena(ARENA_BOUNDS, Vec2.create(HALF_WIDTH + 1, 0))).toBe(
      false,
    );
    expect(isInsideArena(ARENA_BOUNDS, Vec2.create(0, -HALF_WIDTH))).toBe(true);
    expect(isInsideArena(ARENA_BOUNDS, Vec2.create(0, -HALF_WIDTH - 1))).toBe(
      false,
    );
  });

  it("rejects the cut corners even though they sit inside the square", () => {
    const corner: Vec2 = Vec2.create(HALF_WIDTH, HALF_WIDTH);

    expect(
      Math.max(Math.abs(corner.x), Math.abs(corner.y)),
    ).toBeLessThanOrEqual(HALF_WIDTH);
    expect(isInsideArena(ARENA_BOUNDS, corner)).toBe(false);
    expect(
      isInsideArena(ARENA_BOUNDS, Vec2.create(-HALF_WIDTH, HALF_WIDTH)),
    ).toBe(false);
  });

  it("treats the octagon vertex as inclusive and rejects one unit past it", () => {
    expect(isInsideArena(ARENA_BOUNDS, Vec2.create(HALF_WIDTH, CUT))).toBe(
      true,
    );
    expect(isInsideArena(ARENA_BOUNDS, Vec2.create(HALF_WIDTH, CUT + 1))).toBe(
      false,
    );
    expect(isInsideArena(ARENA_BOUNDS, Vec2.create(CUT, HALF_WIDTH))).toBe(
      true,
    );
    expect(isInsideArena(ARENA_BOUNDS, Vec2.create(CUT + 1, HALF_WIDTH))).toBe(
      false,
    );
  });

  it("is symmetric across all four quadrants", () => {
    const inside: Vec2 = Vec2.create(HALF_WIDTH, CUT);
    const outside: Vec2 = Vec2.create(HALF_WIDTH, CUT + 1);

    for (const sx of [1, -1]) {
      for (const sy of [1, -1]) {
        expect(
          isInsideArena(
            ARENA_BOUNDS,
            Vec2.create(sx * inside.x, sy * inside.y),
          ),
        ).toBe(true);
        expect(
          isInsideArena(
            ARENA_BOUNDS,
            Vec2.create(sx * outside.x, sy * outside.y),
          ),
        ).toBe(false);
      }
    }
  });

  it("is relative to bounds.center, not the world origin", () => {
    const shifted: ArenaBounds = {
      center: Vec2.create(1000, -500),
      halfWidth: HALF_WIDTH,
      diagonalExtent: DIAGONAL_EXTENT,
    };

    expect(isInsideArena(shifted, Vec2.create(1000, -500))).toBe(true);
    expect(
      isInsideArena(shifted, Vec2.create(1000 + HALF_WIDTH + 1, -500)),
    ).toBe(false);
    expect(isInsideArena(shifted, Vec2.create(0, 0))).toBe(false);
  });
});

describe("isInsideArena margin", () => {
  it("grows the square edge by the margin, one unit per unit", () => {
    const point: Vec2 = Vec2.create(HALF_WIDTH + 5, 0);

    expect(isInsideArena(ARENA_BOUNDS, point, 0)).toBe(false);
    expect(isInsideArena(ARENA_BOUNDS, point, 4)).toBe(false);
    expect(isInsideArena(ARENA_BOUNDS, point, 5)).toBe(true);
  });

  it("shrinks the square edge under a negative margin", () => {
    const point: Vec2 = Vec2.create(HALF_WIDTH - 5, 0);

    expect(isInsideArena(ARENA_BOUNDS, point, 0)).toBe(true);
    expect(isInsideArena(ARENA_BOUNDS, point, -5)).toBe(true);
    expect(isInsideArena(ARENA_BOUNDS, point, -6)).toBe(false);
  });

  it("grows the diagonal edge by margin * SQRT2, not by margin", () => {
    const point: Vec2 = onDiagonal(DIAGONAL_EXTENT + 10.5);

    expect(isInsideArena(ARENA_BOUNDS, point, 0)).toBe(false);
    expect(isInsideArena(ARENA_BOUNDS, point, 7)).toBe(false);
    expect(isInsideArena(ARENA_BOUNDS, point, 8)).toBe(true);
  });

  it("shrinks the diagonal edge by margin * SQRT2, not by margin", () => {
    const point: Vec2 = onDiagonal(DIAGONAL_EXTENT - 9.5);

    expect(isInsideArena(ARENA_BOUNDS, point, 0)).toBe(true);
    expect(isInsideArena(ARENA_BOUNDS, point, -6)).toBe(true);
    expect(isInsideArena(ARENA_BOUNDS, point, -7)).toBe(false);
  });

  it("must satisfy both edges: a large margin on the square cannot rescue a cut corner", () => {
    const corner: Vec2 = Vec2.create(HALF_WIDTH, HALF_WIDTH);
    const squareOverflow: number = 0;
    const diagonalOverflow: number = 2 * HALF_WIDTH - DIAGONAL_EXTENT;

    expect(squareOverflow).toBeLessThan(diagonalOverflow);
    expect(isInsideArena(ARENA_BOUNDS, corner, 10)).toBe(false);
    expect(
      isInsideArena(ARENA_BOUNDS, corner, diagonalOverflow / Math.SQRT2 + 1),
    ).toBe(true);
  });
});
