import { describe, it, expect } from "vitest";
import { Bound } from "@atlasjs/math";

import { AnimationPlayer, SpriteAnimation, Frame } from "../src";
import { Texture2D } from "../src/core";

function fakeTexture(): Texture2D {
  return {
    id: "t",
    __kind: "texture2D",
    width: 64,
    height: 16,
    destroy: (): void => {},
  } as Texture2D;
}

function animation(n: number): { anim: SpriteAnimation; frames: Frame[] } {
  const texture: Texture2D = fakeTexture();
  const frames: Frame[] = Array.from(
    { length: n },
    (_: unknown, i: number) => new Frame(texture, new Bound(i * 16, 0, 16, 16)),
  );
  const anim: SpriteAnimation = new SpriteAnimation({
    frames,
    fps: 10,
    loop: true,
    autoPlay: true,
  });
  return { anim, frames };
}

describe("AnimationPlayer (dt-driven)", () => {
  it("ticks the current animation and exposes its frame", () => {
    const { anim, frames } = animation(3);
    const player: AnimationPlayer = new AnimationPlayer();
    player.add("walk", anim);
    player.play("walk");
    player.tick(110);
    expect(player.getCurrentFrame()).toBe(frames[1]);
  });

  it("returns undefined frame when no clip is active", () => {
    const player: AnimationPlayer = new AnimationPlayer();
    expect(player.getCurrentFrame()).toBeUndefined();
  });

  it("switches the active clip with play(name)", () => {
    const player: AnimationPlayer = new AnimationPlayer();
    player.add("idle", animation(2).anim);
    player.add("walk", animation(3).anim);
    player.play("idle");
    expect(player.getCurrentAnimationName()).toBe("idle");
    player.play("walk");
    expect(player.getCurrentAnimationName()).toBe("walk");
  });
});
