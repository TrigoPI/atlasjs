import { describe, expect, it } from "vitest";
import { TileSet } from "../src/assets/TileSet";
import { Tile } from "../src/assets/Tile";
import { fakeTexture } from "./helpers/fakes";

describe("TileSet slicing", () => {
  it("slices a 256x256 texture into a 2x2 row-major grid of 128px tiles", () => {
    const set: TileSet = new TileSet(fakeTexture("grass", 256, 256), {
      tileWidth: 128,
      tileHeight: 128,
    });

    expect(set.columns).toBe(2);
    expect(set.rows).toBe(2);
    expect(set.count).toBe(4);

    const t0: Tile = set.getTile(0);
    expect(t0.index).toBe(0);
    expect(t0.sprite.rect.x).toBe(0);
    expect(t0.sprite.rect.y).toBe(0);
    expect(t0.sprite.rect.width).toBe(128);

    expect(set.getTile(1).sprite.rect.x).toBe(128);
    expect(set.getTile(1).sprite.rect.y).toBe(0);
    expect(set.getTile(2).sprite.rect.x).toBe(0);
    expect(set.getTile(2).sprite.rect.y).toBe(128);
    expect(set.getTile(3).sprite.rect.x).toBe(128);
    expect(set.getTile(3).sprite.rect.y).toBe(128);
  });

  it("maps (col,row) to a row-major linear index", () => {
    const set: TileSet = new TileSet(fakeTexture("t", 256, 256), {
      tileWidth: 128,
      tileHeight: 128,
    });

    expect(set.indexOf(0, 0)).toBe(0);
    expect(set.indexOf(1, 0)).toBe(1);
    expect(set.indexOf(0, 1)).toBe(2);
    expect(set.indexOf(1, 1)).toBe(3);
  });

  it("honours margin and spacing (padded atlas)", () => {
    const set: TileSet = new TileSet(fakeTexture("t", 260, 260), {
      tileWidth: 128,
      tileHeight: 128,
      spacing: 2,
      margin: 1,
    });

    expect(set.columns).toBe(2);
    expect(set.getTile(0).sprite.rect.x).toBe(1);
    expect(set.getTile(1).sprite.rect.x).toBe(131);
    expect(set.getTile(2).sprite.rect.y).toBe(131);
  });

  it("throws on out-of-range getTile and returns undefined for tryGetTile", () => {
    const set: TileSet = new TileSet(fakeTexture("t", 128, 128), {
      tileWidth: 128,
      tileHeight: 128,
    });

    expect(set.count).toBe(1);
    expect(() => set.getTile(1)).toThrow();
    expect(set.tryGetTile(1)).toBeUndefined();
    expect(set.tryGetTile(0)).toBeInstanceOf(Tile);
  });
});
