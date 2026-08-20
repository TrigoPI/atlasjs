import { describe, expect, it } from "vitest";

import { SpriteAnimation } from "@atlasjs/nebula";

import { Animator } from "../src/components/Animator";

function createClips(): Record<string, SpriteAnimation> {
  const frames = [
    { texture: {}, rect: {}, pivot: {} },
    { texture: {}, rect: {}, pivot: {} },
    { texture: {}, rect: {}, pivot: {} },
  ] as never[];

  return {
    walk: new SpriteAnimation({ frames, fps: 10, loop: true, autoPlay: true }),
  };
}

describe("Animator pause/resume", () => {
  it("holds the current frame while paused", () => {
    const animator: Animator = new Animator(createClips(), "walk");

    animator.tick(100);
    const held = animator.currentFrame();

    animator.pause();
    animator.tick(1000);

    expect(animator.currentFrame()).toBe(held);
  });

  it("carries on from where it left off once resumed", () => {
    const animator: Animator = new Animator(createClips(), "walk");

    animator.pause();
    animator.tick(1000);
    const held = animator.currentFrame();

    animator.resume();
    animator.tick(100);

    expect(animator.currentFrame()).not.toBe(held);
  });
});
