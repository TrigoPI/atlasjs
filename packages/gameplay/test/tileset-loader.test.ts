import { describe, expect, it } from "vitest";
import { Asset, LoadContext, Resource } from "@atlasjs/assets";
import { TextureAsset, Texture2D } from "@atlasjs/nebula";
import { TileSetAsset } from "../src/assets/TileSetAsset";
import { TileSetLoader } from "../src/assets/TileSetLoader";
import { TileSet } from "../src/assets/TileSet";
import { fakeTexture } from "./helpers/fakes";

describe("TileSetAsset", () => {
  it("has type 'tileset' and derives its id from texture + slicing params", () => {
    const asset: TileSetAsset = new TileSetAsset(new TextureAsset("grass.png"), {
      tileWidth: 128,
      tileHeight: 128,
      columns: 2,
      rows: 2,
    });

    expect(asset.type).toBe("tileset");
    expect(asset.id).toBe("tileset:texture:grass.png:128x128:2x2:0:0");
  });

  it("accepts an explicit id and defaults spacing/margin to 0", () => {
    const asset: TileSetAsset = new TileSetAsset(new TextureAsset("x.png"), {
      tileWidth: 16,
      tileHeight: 16,
      id: "atlas",
    });

    expect(asset.id).toBe("atlas");
    expect(asset.spacing).toBe(0);
    expect(asset.margin).toBe(0);
  });
});

describe("TileSetLoader", () => {
  it("resolves the texture via the context then builds a TileSet", async () => {
    const texture: Texture2D = fakeTexture("grass", 256, 256);
    const ctx: LoadContext = {
      load: async <R extends Resource>(_asset: Asset): Promise<R> =>
        texture as unknown as R,
    };
    const loader: TileSetLoader = new TileSetLoader();
    const asset: TileSetAsset = new TileSetAsset(new TextureAsset("grass.png"), {
      tileWidth: 128,
      tileHeight: 128,
    });

    const set: TileSet = await loader.load(asset, ctx);

    expect(set).toBeInstanceOf(TileSet);
    expect(set.texture).toBe(texture);
    expect(set.count).toBe(4);
  });
});
