import { Vec2 } from "@atlasjs/math";

export type ArenaBounds = {
  center: Vec2;
  halfWidth: number;
  diagonalExtent: number;
};

export const ARENA_SCALE: number = 3;

const HALF_WIDTH_PX: number = 110;
const DIAGONAL_EXTENT_PX: number = 156.5;

export const ARENA_BOUNDS: ArenaBounds = {
  center: Vec2.create(0, 0),
  halfWidth: HALF_WIDTH_PX * ARENA_SCALE,
  diagonalExtent: DIAGONAL_EXTENT_PX * ARENA_SCALE,
};

export function isInsideArena(
  bounds: ArenaBounds,
  point: Vec2,
  margin: number = 0,
): boolean {
  const dx: number = Math.abs(point.x - bounds.center.x);
  const dy: number = Math.abs(point.y - bounds.center.y);

  return (
    Math.max(dx, dy) <= bounds.halfWidth + margin &&
    dx + dy <= bounds.diagonalExtent + margin * Math.SQRT2
  );
}

export function arenaVertices(bounds: ArenaBounds, margin: number = 0): Vec2[] {
  const cx: number = bounds.center.x;
  const cy: number = bounds.center.y;
  const halfWidth: number = bounds.halfWidth + margin;
  const cut: number = bounds.diagonalExtent + margin * Math.SQRT2 - halfWidth;

  return [
    Vec2.create(cx + halfWidth, cy + cut),
    Vec2.create(cx + cut, cy + halfWidth),
    Vec2.create(cx - cut, cy + halfWidth),
    Vec2.create(cx - halfWidth, cy + cut),
    Vec2.create(cx - halfWidth, cy - cut),
    Vec2.create(cx - cut, cy - halfWidth),
    Vec2.create(cx + cut, cy - halfWidth),
    Vec2.create(cx + halfWidth, cy - cut),
  ];
}
