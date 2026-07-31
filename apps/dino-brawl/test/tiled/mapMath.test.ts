import { describe, expect, it } from "vitest";

import {
  colliderFromRect,
  groupCellsByTileset,
  tileObjectPlacement,
  worldPointFromObject,
} from "../../src/game/tiled/mapMath";
import type { PointObject, RectObject, ResolvedTileLayer, ResolvedTileset, TileObject } from "../../src/game/tiled/resolved.types";

const grass: ResolvedTileset = { name: "grass", image: "g.png", firstGid: 1, columns: 8, rows: 8, tileCount: 64, tileWidth: 32, tileHeight: 32, spacing: 0, margin: 0 };
const props: ResolvedTileset = { name: "props", image: "p.png", firstGid: 65, columns: 16, rows: 16, tileCount: 256, tileWidth: 32, tileHeight: 32, spacing: 0, margin: 0 };

describe("groupCellsByTileset", () => {
  it("buckets a layer's cells by their tileset", () => {
    const layer: ResolvedTileLayer = {
      name: "l", groupPath: [], order: 0,
      cells: [
        { cx: 0, cy: 0, tileset: grass, localIndex: 0, flipX: false, flipY: false },
        { cx: 1, cy: 0, tileset: props, localIndex: 0, flipX: false, flipY: false },
        { cx: 2, cy: 0, tileset: grass, localIndex: 3, flipX: false, flipY: false },
      ],
    };
    const buckets = groupCellsByTileset(layer);
    expect(buckets.get(grass)).toHaveLength(2);
    expect(buckets.get(props)).toHaveLength(1);
  });
});

describe("colliderFromRect", () => {
  it("scales a Tiled rect (top-left anchored) into world coords", () => {
    const rect: RectObject = { kind: "rect", name: "wall", x: 10, y: 20, width: 40, height: 8, groupPath: [], properties: {} };
    expect(colliderFromRect(rect, 2)).toEqual({ name: "wall", x: 20, y: 40, width: 80, height: 16, properties: {} });
  });
});

describe("worldPointFromObject", () => {
  it("scales a Tiled point into world coords", () => {
    const point: PointObject = { kind: "point", name: "spawn_point", x: 48, y: 32, groupPath: [], properties: {} };
    expect(worldPointFromObject(point, 2)).toEqual({ name: "spawn_point", x: 96, y: 64, properties: {} });
  });
});

describe("tileObjectPlacement", () => {
  it("anchors the sprite base at the Tiled bottom-left point and scales it", () => {
    const tree: TileObject = { kind: "tile", name: "tree", x: 64, y: 96, width: 32, height: 32, tileset: props, localIndex: 0, flipX: false, flipY: false, groupPath: [], properties: {} };
    const placement = tileObjectPlacement(tree, 2);
    expect(placement.position.x).toBe(160);
    expect(placement.position.y).toBe(192);
    expect(placement.scale.x).toBe(2);
    expect(placement.scale.y).toBe(2);
  });
});
