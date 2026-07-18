import { describe, expect, it } from "vitest";
import { Asset, LoadContext, Resource } from "@atlasjs/assets";
import { TextureAsset, Texture2D } from "@atlasjs/nebula";
import { SpriteAsset } from "../src/assets/SpriteAsset";
import { SpriteLoader } from "../src/assets/SpriteLoader";
import { Sprite } from "../src/assets/Sprite";
import { fakeTexture } from "./helpers/fakes";

describe("SpriteAsset", () => {
  it("has type 'sprite' and derives its id from texture + rect + pivot", () => {
    const texture: TextureAsset = new TextureAsset("dino.png");
    const asset: SpriteAsset = new SpriteAsset(texture);

    expect(asset.type).toBe("sprite");
    expect(asset.id).toBe("sprite:texture:dino.png:full:center");
    expect(asset.texture).toBe(texture);
  });

  it("accepts an explicit id", () => {
    const asset: SpriteAsset = new SpriteAsset(new TextureAsset("x.png"), {
      id: "hero",
    });

    expect(asset.id).toBe("hero");
  });
});

describe("SpriteLoader", () => {
  it("resolves the texture via the context then builds a Sprite handle", async () => {
    const texture: Texture2D = fakeTexture("dino", 64, 32);
    const ctx: LoadContext = {
      load: async <R extends Resource>(_asset: Asset): Promise<R> =>
        texture as unknown as R,
    };
    const loader: SpriteLoader = new SpriteLoader();
    const asset: SpriteAsset = new SpriteAsset(new TextureAsset("dino.png"), {
      id: "hero",
    });

    const sprite: Sprite = await loader.load(asset, ctx);

    expect(sprite).toBeInstanceOf(Sprite);
    expect(sprite.texture).toBe(texture);
    expect(sprite.id).toBe("hero");
  });
});
