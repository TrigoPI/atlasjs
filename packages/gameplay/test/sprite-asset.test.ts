import { describe, expect, it } from "vitest";
import { Bound, Vec2 } from "@atlasjs/math";
import { Sprite } from "../src/assets";
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
