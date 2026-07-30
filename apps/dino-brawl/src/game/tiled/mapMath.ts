import { Vec2 } from "@atlasjs/math";

import type {
  PointObject,
  RectObject,
  ResolvedCell,
  ResolvedTileLayer,
  ResolvedTileset,
  TileObject,
} from "./resolved.types";

export interface MapCollider {
  readonly name: string;
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
  readonly properties: Readonly<Record<string, unknown>>;
}

export interface WorldPoint {
  readonly name: string;
  readonly x: number;
  readonly y: number;
  readonly properties: Readonly<Record<string, unknown>>;
}

export interface TilePlacement {
  readonly position: Vec2;
  readonly scale: Vec2;
}

export function groupCellsByTileset(layer: ResolvedTileLayer): Map<ResolvedTileset, ResolvedCell[]> {
  const buckets: Map<ResolvedTileset, ResolvedCell[]> = new Map<ResolvedTileset, ResolvedCell[]>();

  for (const cell of layer.cells) {
    const existing: ResolvedCell[] | undefined = buckets.get(cell.tileset);
    if (existing) {
      existing.push(cell);
    } else {
      buckets.set(cell.tileset, [cell]);
    }
  }

  return buckets;
}

export function colliderFromRect(obj: RectObject, scale: number): MapCollider {
  return {
    name: obj.name,
    x: obj.x * scale,
    y: obj.y * scale,
    width: obj.width * scale,
    height: obj.height * scale,
    properties: obj.properties,
  };
}

export function worldPointFromObject(obj: PointObject, scale: number): WorldPoint {
  return {
    name: obj.name,
    x: obj.x * scale,
    y: obj.y * scale,
    properties: obj.properties,
  };
}

export function tileObjectPlacement(obj: TileObject, scale: number): TilePlacement {
  const scaleX: number = (obj.width / obj.tileset.tileWidth) * scale;
  const scaleY: number = (obj.height / obj.tileset.tileHeight) * scale;
  const position: Vec2 = new Vec2((obj.x + obj.width / 2) * scale, obj.y * scale);
  return { position, scale: new Vec2(scaleX, scaleY) };
}
