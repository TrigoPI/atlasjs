import { describe, expect, it } from "vitest";
import { Bound, Vec2 } from "@atlasjs/math";
import type { Texture2D } from "@atlasjs/nebula";
import { TileMap } from "../src/components/TileMap";
import type { TileSet } from "../src/assets/TileSet";
import type { Tile } from "../src/assets/Tile";
import { bakeOccluderStrips } from "../src/systems/utils/bake-occluder-strips";
import type { OccluderRegion } from "../src/systems/utils/bake-occluder-strips";

function makeTileSet(): TileSet {
  const texture: Texture2D = {
    width: 128,
    height: 128,
  } as unknown as Texture2D;
  const tile: Tile = {
    index: 0,
    sprite: { rect: new Bound(0, 0, 32, 32) },
  } as unknown as Tile;
  return {
    texture,
    tryGetTile: (_index: number): Tile => tile,
    getTile: (_index: number): Tile => tile,
  } as unknown as TileSet;
}

describe("bakeOccluderStrips", () => {
  it("slice 'single' → un strip, tuiles ramassées, footY = footYWorld", () => {
    const layer: TileMap = new TileMap(makeTileSet());
    layer.setTile(0, 0, 0);
    layer.setTile(1, 0, 0);
    layer.setTile(0, 1, 0);
    layer.setTile(1, 1, 0);

    const region: OccluderRegion = {
      cellBounds: { cxMin: 0, cyMin: 0, cxMax: 1, cyMax: 1 },
      slice: "single",
      sortingLayer: "Entities",
      footYWorld: 320,
      rowFootYWorld: (cy: number): number => (cy + 1) * 64,
    };

    const strips = bakeOccluderStrips(
      region,
      layer,
      new Vec2(32, 32),
      new Vec2(0, 0),
    );

    expect(strips.length).toBe(1);
    expect(strips[0].footY).toBe(320);
    expect(strips[0].tiles.length).toBe(4);
    expect(strips[0].sortingLayer).toBe("Entities");
    expect(strips[0].texture).toBe(layer.tileset.texture);
    expect(strips[0].tiles[0]).toMatchObject({
      x: 0,
      y: 0,
      width: 32,
      height: 32,
    });
    expect(strips[0].tiles[0].uvRect).toMatchObject({
      x: 0,
      y: 0,
      z: 0.25,
      w: 0.25,
    });
  });

  it("slice 'perRow' → un strip par rangée non vide, footY = rowFootYWorld(cy)", () => {
    const layer: TileMap = new TileMap(makeTileSet());
    layer.setTile(0, 0, 0);
    layer.setTile(1, 0, 0);
    layer.setTile(0, 2, 0);

    const region: OccluderRegion = {
      cellBounds: { cxMin: 0, cyMin: 0, cxMax: 1, cyMax: 2 },
      slice: "perRow",
      sortingLayer: "Entities",
      footYWorld: 999,
      rowFootYWorld: (cy: number): number => (cy + 1) * 64,
    };

    const strips = bakeOccluderStrips(
      region,
      layer,
      new Vec2(32, 32),
      new Vec2(0, 0),
    );

    expect(strips.length).toBe(2);
    expect(strips[0].footY).toBe(64);
    expect(strips[0].tiles.length).toBe(2);
    expect(strips[1].footY).toBe(192);
    expect(strips[1].tiles.length).toBe(1);
  });

  it("région vide → aucun strip", () => {
    const layer: TileMap = new TileMap(makeTileSet());
    const region: OccluderRegion = {
      cellBounds: { cxMin: 0, cyMin: 0, cxMax: 2, cyMax: 2 },
      slice: "single",
      sortingLayer: "Entities",
      footYWorld: 10,
      rowFootYWorld: (cy: number): number => cy,
    };
    expect(
      bakeOccluderStrips(region, layer, new Vec2(32, 32), new Vec2(0, 0)),
    ).toEqual([]);
  });
});
