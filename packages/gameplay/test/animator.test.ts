import { describe, it, expect } from "vitest";
import { Bound } from "@atlasjs/math";
import { SpriteAnimation, Frame } from "@atlasjs/nebula";

import { Animator } from "../src";
import { fakeTexture } from "./helpers/fakes";

function clip(n: number): { anim: SpriteAnimation; frames: Frame[] } {
  const texture = fakeTexture();
  const frames: Frame[] = Array.from(
    { length: n },
    (_: unknown, i: number) => new Frame(texture, new Bound(i * 16, 0, 16, 32)),
  );
  const anim: SpriteAnimation = new SpriteAnimation({
    frames,
    fps: 10,
    loop: true,
    autoPlay: true,
  });
  return { anim, frames };
}

describe("Animator", () => {
  it("has no active clip without an initial", () => {
    const animator: Animator = new Animator({ idle: clip(2).anim });
    expect(animator.playing).toBeNull();
    expect(animator.currentFrame()).toBeNull();
  });

  it("plays the initial clip", () => {
    const idle = clip(2);
    const animator: Animator = new Animator({ idle: idle.anim }, "idle");
    expect(animator.playing).toBe("idle");
    expect(animator.currentFrame()).toBe(idle.frames[0]);
  });

  it("switches clips with play(name)", () => {
    const animator: Animator = new Animator(
      { idle: clip(2).anim, walk: clip(3).anim },
      "idle",
    );
    animator.play("walk");
    expect(animator.playing).toBe("walk");
  });

  it("play(name) on the active clip does not restart it", () => {
    const walk = clip(3);
    const animator: Animator = new Animator({ walk: walk.anim }, "walk");
    animator.tick(110);
    expect(animator.currentFrame()).toBe(walk.frames[1]);
    animator.play("walk");
    expect(animator.currentFrame()).toBe(walk.frames[1]);
  });

  it("tick advances the active clip", () => {
    const walk = clip(3);
    const animator: Animator = new Animator({ walk: walk.anim }, "walk");
    animator.tick(210);
    expect(animator.currentFrame()).toBe(walk.frames[2]);
  });
});
