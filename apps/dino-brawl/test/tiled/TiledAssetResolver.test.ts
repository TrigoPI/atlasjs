import { describe, expect, it } from "vitest";

import { matchAssetByTail } from "../../src/game/tiled/TiledAssetResolver";

const modules: Record<string, string> = {
  "../../../assets/tilesets/ground/grass-tileset.png": "/hashed/grass.abc.png",
  "../../../assets/tilesets/props/props.png": "/hashed/props.def.png",
};

describe("matchAssetByTail", () => {
  it("matches a Tiled image path to the bundled URL by trailing path", () => {
    expect(matchAssetByTail(modules, "../assets/tilesets/ground/grass-tileset.png")).toBe("/hashed/grass.abc.png");
    expect(matchAssetByTail(modules, "../assets/tilesets/props/props.png")).toBe("/hashed/props.def.png");
  });

  it("returns undefined when no basename matches", () => {
    expect(matchAssetByTail(modules, "../assets/tilesets/none.png")).toBeUndefined();
  });

  it("disambiguates equal basenames by the longest matching tail", () => {
    const collide: Record<string, string> = {
      "../../../assets/tilesets/a/wall.png": "/hashed/a-wall.png",
      "../../../assets/tilesets/b/wall.png": "/hashed/b-wall.png",
    };
    expect(matchAssetByTail(collide, "../assets/tilesets/b/wall.png")).toBe("/hashed/b-wall.png");
  });
});
