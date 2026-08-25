import { Vec2, Vec4 } from "@atlasjs/math";
import type { Bound } from "@atlasjs/math";
import type { TileInstance, Texture2D } from "@atlasjs/nebula";
import type { Tile } from "@atlasjs/nebula";
import type { TileMap } from "../components/TileMap";
import { cellOrigin } from "../systems/utils/tilemap-geometry";
import type { CellOrigin, CellRange } from "../systems/utils/tilemap-geometry";

export type OccluderStripData = {
  footY: number;
  tiles: TileInstance[];
  texture: Texture2D;
  sortingLayer: string;
};

export type OccluderRegion = {
  cellBounds: CellRange;
  slice: "single" | "perRow";
  sortingLayer: string;
  footYWorld: number;
  rowFootYWorld: (cy: number) => number;
};

type BakeContext = {
  layer: TileMap;
  bounds: CellRange;
  cellSize: Vec2;
  cellGap: Vec2;
  textureWidth: number;
  textureHeight: number;
};

function tileInstanceAt(
  context: BakeContext,
  cx: number,
  cy: number,
): TileInstance | undefined {
  const index: number = context.layer.getTile(cx, cy);

  if (index < 0) {
    return undefined;
  }

  const tile: Tile | undefined = context.layer.tileset.tryGetTile(index);

  if (tile === undefined) {
    return undefined;
  }

  const rect: Bound = tile.sprite.rect;
  const origin: CellOrigin = cellOrigin(
    context.cellSize,
    context.cellGap,
    cx,
    cy,
  );

  return {
    x: origin.x,
    y: origin.y,
    width: rect.width,
    height: rect.height,
    uvRect: new Vec4(
      rect.x / context.textureWidth,
      rect.y / context.textureHeight,
      rect.width / context.textureWidth,
      rect.height / context.textureHeight,
    ),
  };
}

function appendRowTiles(
  context: BakeContext,
  cy: number,
  out: TileInstance[],
): void {
  const bounds: CellRange = context.bounds;

  for (let cx: number = bounds.cxMin; cx <= bounds.cxMax; cx++) {
    const instance: TileInstance | undefined = tileInstanceAt(context, cx, cy);

    if (instance !== undefined) {
      out.push(instance);
    }
  }
}

export function bakeOccluderStrips(
  region: OccluderRegion,
  layer: TileMap,
  cellSize: Vec2,
  cellGap: Vec2,
): OccluderStripData[] {
  const texture: Texture2D = layer.tileset.texture;
  const bounds: CellRange = region.cellBounds;
  const context: BakeContext = {
    layer,
    bounds,
    cellSize,
    cellGap,
    textureWidth: texture.width,
    textureHeight: texture.height,
  };

  if (region.slice === "single") {
    const tiles: TileInstance[] = [];

    for (let cy: number = bounds.cyMin; cy <= bounds.cyMax; cy++) {
      appendRowTiles(context, cy, tiles);
    }

    if (tiles.length === 0) {
      return [];
    }

    return [
      {
        footY: region.footYWorld,
        tiles,
        texture,
        sortingLayer: region.sortingLayer,
      },
    ];
  }

  const out: OccluderStripData[] = [];

  for (let cy: number = bounds.cyMin; cy <= bounds.cyMax; cy++) {
    const tiles: TileInstance[] = [];
    appendRowTiles(context, cy, tiles);

    if (tiles.length === 0) {
      continue;
    }

    out.push({
      footY: region.rowFootYWorld(cy),
      tiles,
      texture,
      sortingLayer: region.sortingLayer,
    });
  }

  return out;
}
