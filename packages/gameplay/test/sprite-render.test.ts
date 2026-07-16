import { describe, expect, it } from "vitest";
import { Color } from "@atlasjs/nebula";
import { Sprite } from "../src/assets";
import { SpriteRender } from "../src/components";
import { fakeTexture } from "./helpers/fakes";

describe("SpriteRender", () => {
  it("defaults to white, unflipped, visible, order 0", () => {
    const render: SpriteRender = new SpriteRender(new Sprite(fakeTexture()));

    expect(render.color.r).toBe(1);
    expect(render.color.a).toBe(1);
    expect(render.flipX).toBe(false);
    expect(render.flipY).toBe(false);
    expect(render.visible).toBe(true);
    expect(render.sortingOrder).toBe(0);
  });

  it("accepts explicit overrides", () => {
    const render: SpriteRender = new SpriteRender(
      new Sprite(fakeTexture()),
      Color.Red(),
      true,
      false,
      false,
      7,
    );

    expect(render.color.r).toBe(1);
    expect(render.color.g).toBe(0);
    expect(render.flipX).toBe(true);
    expect(render.visible).toBe(false);
    expect(render.sortingOrder).toBe(7);
  });
});
