import { describe, expect, it } from "vitest";
import { TextureAsset } from "../src/assets/TextureAsset";

describe("TextureAsset", () => {
  it("has type 'texture' and derives its id from the source", () => {
    const asset: TextureAsset = new TextureAsset("game/dino.png");

    expect(asset.type).toBe("texture");
    expect(asset.id).toBe("texture:game/dino.png");
    expect(asset.source).toBe("game/dino.png");
  });

  it("accepts an explicit id and format", () => {
    const asset: TextureAsset = new TextureAsset("x.png", {
      id: "hero",
      format: "rgba8unorm",
    });

    expect(asset.id).toBe("hero");
    expect(asset.format).toBe("rgba8unorm");
  });
});
