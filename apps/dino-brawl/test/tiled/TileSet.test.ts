import { describe, expect, it } from "vitest";

import { TileSet } from "../../src/game/tiled/TileSet";

const grass = new TileSet({
  name: "grass-tileset",
  columns: 8,
  imageHeight: 256,
  imageWidth: 256,
  tileWidth: 32,
  tileHeight: 32,
  tileCount: 64,
  firstGid: 1,
});

const props = new TileSet({
  name: "props",
  columns: 16,
  imageHeight: 512,
  imageWidth: 512,
  tileWidth: 32,
  tileHeight: 32,
  tileCount: 256,
  firstGid: 65,
});

describe("TileSet.getId", () => {
  it("maps grass gids to grid indices", () => {
    expect(grass.getId(1)).toEqual({ x: 0, y: 7 });
    expect(grass.getId(2)).toEqual({ x: 1, y: 7 });
    expect(grass.getId(9)).toEqual({ x: 0, y: 6 });
    expect(grass.getId(64)).toEqual({ x: 7, y: 0 });
  });

  it("maps props gids to grid indices", () => {
    expect(props.getId(65)).toEqual({ x: 0, y: 15 });
    expect(props.getId(81)).toEqual({ x: 0, y: 14 });
  });
});

describe("TileSet.isIdIn", () => {
  it("bounds grass to [firstGid, firstGid + tileCount - 1]", () => {
    expect(grass.isIdIn(1)).toBe(true);
    expect(grass.isIdIn(64)).toBe(true);
    expect(grass.isIdIn(0)).toBe(false);
    expect(grass.isIdIn(65)).toBe(false);
  });

  it("bounds props to [firstGid, firstGid + tileCount - 1]", () => {
    expect(props.isIdIn(65)).toBe(true);
    expect(props.isIdIn(320)).toBe(true);
    expect(props.isIdIn(64)).toBe(false);
    expect(props.isIdIn(321)).toBe(false);
  });
});

describe("TileSet dimensions", () => {
  it("exposes tile dimensions from the descriptor", () => {
    expect(grass.tileWidth).toBe(32);
    expect(grass.tileHeight).toBe(32);
  });
});
