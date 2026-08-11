import { describe, it, expect } from "vitest";
import { Bound } from "@atlasjs/math";
import { SpriteAnimation, Frame } from "@atlasjs/nebula";

import { Animator } from "../src";
import { fakeTexture } from "./helpers/fakes";

function clip(n: number): { anim: SpriteAnimation; frames: Frame[] } {
  return clipOpts(n, true);
}

function clipOpts(
  n: number,
  loop: boolean,
): { anim: SpriteAnimation; frames: Frame[] } {
  const texture = fakeTexture();
  const frames: Frame[] = Array.from(
    { length: n },
    (_: unknown, i: number) => new Frame(texture, new Bound(i * 16, 0, 16, 32)),
  );
  const anim: SpriteAnimation = new SpriteAnimation({
    frames,
    fps: 10,
    loop,
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

describe("Animator events", () => {
  it("emits started with the clip name when play switches clips", () => {
    const animator: Animator = new Animator(
      { idle: clipOpts(2, true).anim, walk: clipOpts(3, true).anim },
      "idle",
    );
    const seen: string[] = [];
    animator.on("started", (clip: string) => seen.push(clip));

    animator.play("walk");

    expect(seen).toEqual(["walk"]);
  });

  it("does not emit started when play targets the active clip", () => {
    const animator: Animator = new Animator(
      { idle: clipOpts(2, true).anim },
      "idle",
    );
    const seen: string[] = [];
    animator.on("started", (clip: string) => seen.push(clip));

    animator.play("idle");

    expect(seen).toEqual([]);
  });

  it("emits finished once when a non-looping clip reaches its last frame", () => {
    const animator: Animator = new Animator(
      { attack: clipOpts(2, false).anim },
      "attack",
    );
    const seen: string[] = [];
    animator.on("finished", (clip: string) => seen.push(clip));

    animator.tick(100);
    animator.tick(100);

    expect(seen).toEqual(["attack"]);
  });

  it("never emits finished for a looping clip", () => {
    const animator: Animator = new Animator(
      { run: clipOpts(2, true).anim },
      "run",
    );
    const seen: string[] = [];
    animator.on("finished", (clip: string) => seen.push(clip));

    animator.tick(1000);

    expect(seen).toEqual([]);
  });

  it("emits loop on each wrap of a looping clip", () => {
    const animator: Animator = new Animator(
      { run: clipOpts(2, true).anim },
      "run",
    );
    const seen: string[] = [];
    animator.on("loop", (clip: string) => seen.push(clip));

    for (let i: number = 0; i < 4; i++) {
      animator.tick(100);
    }

    expect(seen).toEqual(["run", "run"]);
  });

  it("does not emit loop for a non-looping clip", () => {
    const animator: Animator = new Animator(
      { attack: clipOpts(2, false).anim },
      "attack",
    );
    const seen: string[] = [];
    animator.on("loop", (clip: string) => seen.push(clip));

    animator.tick(1000);

    expect(seen).toEqual([]);
  });

  it("off unsubscribes a listener", () => {
    const animator: Animator = new Animator(
      { attack: clipOpts(2, false).anim },
      "attack",
    );
    const seen: string[] = [];
    const cb = (clip: string): void => {
      seen.push(clip);
    };
    animator.on("finished", cb);
    animator.off("finished", cb);

    animator.tick(100);

    expect(seen).toEqual([]);
  });

  it("notifies every subscriber of an event", () => {
    const animator: Animator = new Animator(
      { idle: clipOpts(2, true).anim, walk: clipOpts(3, true).anim },
      "idle",
    );
    const a: string[] = [];
    const b: string[] = [];
    animator.on("started", (clip: string) => a.push(clip));
    animator.on("started", (clip: string) => b.push(clip));

    animator.play("walk");

    expect(a).toEqual(["walk"]);
    expect(b).toEqual(["walk"]);
  });
});
