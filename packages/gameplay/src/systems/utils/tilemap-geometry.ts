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
  return invWorld.transformBound(worldBound, new Bound());
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
