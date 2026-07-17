import { describe, it, expect } from "vitest";
import { Bound } from "@atlasjs/math";

import { SpriteAnimation, Frame } from "../src";
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

function frames(n: number): Frame[] {
  const texture: Texture2D = fakeTexture();
  return Array.from(
    { length: n },
    (_: unknown, i: number) => new Frame(texture, new Bound(i * 16, 0, 16, 16)),
  );
}

describe("SpriteAnimation (dt-driven)", () => {
  it("advances one frame once frameDuration elapses", () => {
    const anim: SpriteAnimation = new SpriteAnimation({
      frames: frames(3),
      fps: 10,
      loop: true,
      autoPlay: true,
    });
    expect(anim.getCurrentFrameIndex()).toBe(0);
    anim.tick(50);
    expect(anim.getCurrentFrameIndex()).toBe(0);
    anim.tick(60);
    expect(anim.getCurrentFrameIndex()).toBe(1);
  });

  it("wraps the index while looping", () => {
    const anim: SpriteAnimation = new SpriteAnimation({
      frames: frames(2),
      fps: 10,
      loop: true,
      autoPlay: true,
    });
    anim.tick(250);
    expect(anim.getCurrentFrameIndex()).toBe(0);
  });

  it("clamps and stops on the last frame when not looping", () => {
    const anim: SpriteAnimation = new SpriteAnimation({
      frames: frames(3),
      fps: 10,
      loop: false,
      autoPlay: true,
    });
    anim.tick(1000);
    expect(anim.getCurrentFrameIndex()).toBe(2);
    expect(anim.isPlaying()).toBe(false);
  });

  it("does not advance while paused and resumes without reset", () => {
    const anim: SpriteAnimation = new SpriteAnimation({
      frames: frames(3),
      fps: 10,
      loop: true,
      autoPlay: true,
    });
    anim.tick(110);
    anim.pause();
    anim.tick(500);
    expect(anim.getCurrentFrameIndex()).toBe(1);
    anim.resume();
    anim.tick(100);
    expect(anim.getCurrentFrameIndex()).toBe(2);
  });

  it("stop resets to frame 0 and halts", () => {
    const anim: SpriteAnimation = new SpriteAnimation({
      frames: frames(3),
      fps: 10,
      loop: true,
      autoPlay: true,
    });
    anim.tick(150);
    anim.stop();
    expect(anim.getCurrentFrameIndex()).toBe(0);
    expect(anim.isPlaying()).toBe(false);
  });
});
