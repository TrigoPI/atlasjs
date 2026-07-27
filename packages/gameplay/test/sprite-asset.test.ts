import { describe, expect, it } from "vitest";
import { Bound, Vec2 } from "@atlasjs/math";
import { Sprite } from "../src/assets";
import { SpriteAsset } from "../src/assets/SpriteAsset";
import { fakeTexture } from "./helpers/fakes";

describe("Sprite asset", () => {
  it("defaults rect to the full texture and pivot to center", () => {
    const sprite: Sprite = new Sprite(fakeTexture("t", 64, 32));

    expect(sprite.rect.x).toBe(0);
    expect(sprite.rect.y).toBe(0);
    expect(sprite.rect.width).toBe(64);
    expect(sprite.rect.height).toBe(32);
    expect(sprite.pivot.x).toBe(0.5);
    expect(sprite.pivot.y).toBe(0.5);
  });

  it("clones rect and pivot so caller mutations do not leak in", () => {
    const rect: Bound = new Bound(0, 0, 16, 16);
    const pivot: Vec2 = new Vec2(0, 0);
    const sprite: Sprite = new Sprite(fakeTexture(), { rect, pivot });

    rect.set(99, 99, 99, 99);
    pivot.set(1, 1);

    expect(sprite.rect.width).toBe(16);
    expect(sprite.pivot.x).toBe(0);
  });

  it("accepts an explicit id and has a no-op destroy", () => {
    const sprite: Sprite = new Sprite(fakeTexture(), { id: "hero" });

    expect(sprite.id).toBe("hero");
    expect(() => sprite.destroy()).not.toThrow();
  });
});

describe("SpriteAsset.fromPath", () => {
  it("forwards rect and pivot into the asset", () => {
    const asset: SpriteAsset = SpriteAsset.fromPath("tree.png", {
      rect: new Bound(0, 0, 96, 160),
      pivot: new Vec2(0.5, 1),
    });

    expect(asset.rect?.width).toBe(96);
    expect(asset.rect?.height).toBe(160);
    expect(asset.pivot?.x).toBe(0.5);
    expect(asset.pivot?.y).toBe(1);
  });

  it("leaves rect and pivot undefined when no options are given", () => {
    const asset: SpriteAsset = SpriteAsset.fromPath("tree.png");

    expect(asset.rect).toBeUndefined();
    expect(asset.pivot).toBeUndefined();
  });
});
