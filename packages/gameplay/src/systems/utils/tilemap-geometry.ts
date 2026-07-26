import { Bound, type Mat3, type Vec2 } from "@atlasjs/math";

export type CellRange = {
  cxMin: number;
  cyMin: number;
  cxMax: number;
  cyMax: number;
};

export type CellOrigin = {
  x: number;
  y: number;
};

export function cellOrigin(
  cellSize: Vec2,
  cellGap: Vec2,
  cx: number,
  cy: number,
): CellOrigin {
  return {
    x: cx * (cellSize.x + cellGap.x),
    y: cy * (cellSize.y + cellGap.y),
  };
}

export function worldBoundToLocalBound(
  invWorld: Mat3,
  worldBound: Bound,
): Bound {
  const x0: number = worldBound.x;
  const y0: number = worldBound.y;
  const x1: number = worldBound.x + worldBound.width;
  const y1: number = worldBound.y + worldBound.height;

  const c0: Vec2 = invWorld.transformPoint2(x0, y0);
  const c1: Vec2 = invWorld.transformPoint2(x1, y0);
  const c2: Vec2 = invWorld.transformPoint2(x0, y1);
  const c3: Vec2 = invWorld.transformPoint2(x1, y1);

  const minX: number = Math.min(c0.x, c1.x, c2.x, c3.x);
  const minY: number = Math.min(c0.y, c1.y, c2.y, c3.y);
  const maxX: number = Math.max(c0.x, c1.x, c2.x, c3.x);
  const maxY: number = Math.max(c0.y, c1.y, c2.y, c3.y);

  return new Bound(minX, minY, maxX - minX, maxY - minY);
}

export function visibleCellRange(
  cellSize: Vec2,
  cellGap: Vec2,
  local: Bound,
): CellRange {
  const strideX: number = cellSize.x + cellGap.x;
  const strideY: number = cellSize.y + cellGap.y;

  return {
    cxMin: Math.floor(local.x / strideX),
    cyMin: Math.floor(local.y / strideY),
    cxMax: Math.floor((local.x + local.width) / strideX),
    cyMax: Math.floor((local.y + local.height) / strideY),
  };
}
