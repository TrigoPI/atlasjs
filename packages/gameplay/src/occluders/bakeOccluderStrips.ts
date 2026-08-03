import { Vec2, Vec4 } from "@atlasjs/math";
import type { Bound } from "@atlasjs/math";
import type { TileInstance, Texture2D } from "@atlasjs/nebula";
import type { Tile } from "../assets/Tile";
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

export function bakeOccluderStrips(
  region: OccluderRegion,
  layer: TileMap,
  cellSize: Vec2,
  cellGap: Vec2,
): OccluderStripData[] {
  const texture: Texture2D = layer.tileset.texture;
  const texW: number = texture.width;
  const texH: number = texture.height;
  const bounds: CellRange = region.cellBounds;

  const instanceAt = (cx: number, cy: number): TileInstance | undefined => {
    const index: number = layer.getTile(cx, cy);

    if (index < 0) {
      return undefined;
    }

    const tile: Tile | undefined = layer.tileset.tryGetTile(index);

    if (tile === undefined) {
      return undefined;
    }

    const rect: Bound = tile.sprite.rect;
    const origin: CellOrigin = cellOrigin(cellSize, cellGap, cx, cy);

    return {
      x: origin.x,
      y: origin.y,
      width: rect.width,
      height: rect.height,
      uvRect: new Vec4(
        rect.x / texW,
        rect.y / texH,
        rect.width / texW,
        rect.height / texH,
      ),
    };
  };

  const rowTiles = (cy: number): TileInstance[] => {
    const tiles: TileInstance[] = [];
    for (let cx: number = bounds.cxMin; cx <= bounds.cxMax; cx++) {
      const inst: TileInstance | undefined = instanceAt(cx, cy);
      if (inst !== undefined) {
        tiles.push(inst);
      }
    }

    return tiles;
  };

  if (region.slice === "single") {
    const tiles: TileInstance[] = [];

    for (let cy: number = bounds.cyMin; cy <= bounds.cyMax; cy++) {
      tiles.push(...rowTiles(cy));
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
    const tiles: TileInstance[] = rowTiles(cy);

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
