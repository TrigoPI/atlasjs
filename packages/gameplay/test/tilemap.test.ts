import { describe, expect, it } from "vitest";
import { TileSet } from "../src/assets/TileSet";
import { TileMap } from "../src/components/TileMap";
import { fakeTexture } from "./helpers/fakes";

function makeTileSet(): TileSet {
  return new TileSet(fakeTexture("t", 256, 256), {
    tileWidth: 128,
    tileHeight: 128,
  });
}

describe("TileMap storage", () => {
  it("returns -1 for an empty cell and stores a tile index", () => {
    const map: TileMap = new TileMap(makeTileSet());
    expect(map.getTile(3, 5)).toBe(-1);
    expect(map.hasTile(3, 5)).toBe(false);

    map.setTile(3, 5, 2);
    expect(map.getTile(3, 5)).toBe(2);
    expect(map.hasTile(3, 5)).toBe(true);
  });

  it("clears a cell via a negative index or removeTile", () => {
    const map: TileMap = new TileMap(makeTileSet());
    map.setTile(1, 1, 0);
    map.setTile(1, 1, -1);
    expect(map.getTile(1, 1)).toBe(-1);

    map.setTile(2, 2, 0);
    map.removeTile(2, 2);
    expect(map.hasTile(2, 2)).toBe(false);
  });

  it("supports negative coordinates round-trip via forEachTile", () => {
    const map: TileMap = new TileMap(makeTileSet());
    map.setTile(-3, -7, 1);

    const seen: Array<[number, number, number]> = [];
    map.forEachTile((cx: number, cy: number, index: number) => {
      seen.push([cx, cy, index]);
    });

    expect(seen).toEqual([[-3, -7, 1]]);
  });

  it("fills an inclusive rectangle and clears everything", () => {
    const map: TileMap = new TileMap(makeTileSet());
    map.fill(0, 0, 2, 1, 3);

    let count: number = 0;
    map.forEachTile(() => {
      count++;
    });
    expect(count).toBe(6);
    expect(map.getTile(2, 1)).toBe(3);

    map.clear();
    expect(map.getTile(0, 0)).toBe(-1);
  });

  it("bumps revision on mutation only", () => {
    const map: TileMap = new TileMap(makeTileSet());
    const r0: number = map.revision;

    map.setTile(0, 0, 1);
    const r1: number = map.revision;
    expect(r1).toBeGreaterThan(r0);

    map.removeTile(9, 9);
    expect(map.revision).toBe(r1);
  });
});
