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

  it("ignores replaying the clip already running", () => {
    const animator: Animator = new Animator(createClips(), "walk");

    animator.tick(150);
    const advanced = animator.currentFrame();

    animator.play("walk");

    expect(animator.currentFrame()).toBe(advanced);
  });

  it("replays from the first frame when asked to restart", () => {
    const animator: Animator = new Animator(createClips(), "walk");

    const first = animator.currentFrame();
    animator.tick(150);
    expect(animator.currentFrame()).not.toBe(first);

    animator.play("walk", true);

    expect(animator.currentFrame()).toBe(first);
  });
});
