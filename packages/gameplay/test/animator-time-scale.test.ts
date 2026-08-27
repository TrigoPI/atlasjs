import { describe, expect, it } from "vitest";
import { Bound } from "@atlasjs/math";
import { Entity } from "@atlasjs/nexus";
import { Frame, SpriteAnimation } from "@atlasjs/nebula";
import type { Texture2D } from "@atlasjs/nebula";

import { Animator, Sprite, SpriteRender, Transform2D } from "../src";
import { TIME_SCALE_MANAGER, TimeScaleManager } from "../src/time";
import { TimeScale } from "../src/components";
import { AnimatorSystem } from "../src/systems";
import { createHarness, Harness } from "./helpers/harness";
import { fakeTexture } from "./helpers/fakes";

type Clip = { clip: SpriteAnimation; frames: Frame[] };

function twoFrameClip(): Clip {
  const texture: Texture2D = fakeTexture("sheet", 64, 32);
  const frames: Frame[] = [
    new Frame(texture, new Bound(0, 0, 16, 32)),
    new Frame(texture, new Bound(16, 0, 16, 32)),
  ];
  return {
    clip: new SpriteAnimation({ frames, fps: 10, loop: true, autoPlay: true }),
    frames,
  };
}

describe("AnimatorSystem and TimeScale", () => {
  it("advances the animation at the raw dt with no scale", async () => {
    const harness: Harness = await createHarness();
    const texture: Texture2D = fakeTexture("sheet", 64, 32);
    const { clip, frames }: Clip = twoFrameClip();

    const entity: Entity = harness.world.createEntity();
    harness.world.addComponent(entity, Transform2D);
    harness.world.addComponent(entity, SpriteRender, new Sprite(texture));
    harness.world.addComponent(entity, Animator, { walk: clip }, "walk");

    harness.frame();

    const animator: Animator = harness.world.getComponent(
      entity,
      Animator,
    ) as Animator;
    expect(animator.currentFrame()).toBe(frames[1]);
  });

  it("does not advance the animation of a frozen entity", async () => {
    const harness: Harness = await createHarness();
    const manager: TimeScaleManager = harness.services.get(TIME_SCALE_MANAGER);
    const texture: Texture2D = fakeTexture("sheet", 64, 32);
    const { clip, frames }: Clip = twoFrameClip();

    const entity: Entity = harness.world.createEntity();
    harness.world.addComponent(entity, Transform2D);
    harness.world.addComponent(entity, SpriteRender, new Sprite(texture));
    harness.world.addComponent(entity, Animator, { walk: clip }, "walk");

    manager.setScale(entity, 0);

    harness.frame();
    harness.frame();

    const animator: Animator = harness.world.getComponent(
      entity,
      Animator,
    ) as Animator;
    expect(animator.currentFrame()).toBe(frames[0]);
  });

  it("freezes a child's animation through its parent's scale", async () => {
    const harness: Harness = await createHarness();
    const manager: TimeScaleManager = harness.services.get(TIME_SCALE_MANAGER);
    const texture: Texture2D = fakeTexture("sheet", 64, 32);
    const { clip, frames }: Clip = twoFrameClip();

    const root: Entity = harness.world.createEntity();
    const child: Entity = harness.world.createEntity();
    harness.world.setParent(child, root);

    harness.world.addComponent(child, Transform2D);
    harness.world.addComponent(child, SpriteRender, new Sprite(texture));
    harness.world.addComponent(child, Animator, { walk: clip }, "walk");

    manager.setScale(root, 0);

    harness.frame();
    harness.frame();

    const animator: Animator = harness.world.getComponent(
      child,
      Animator,
    ) as Animator;
    expect(animator.currentFrame()).toBe(frames[0]);
  });

  it("advances the animation at half speed under a scale of 0.5", async () => {
    const harness: Harness = await createHarness();
    const manager: TimeScaleManager = harness.services.get(TIME_SCALE_MANAGER);
    const texture: Texture2D = fakeTexture("sheet", 64, 32);
    const { clip, frames }: Clip = twoFrameClip();

    const entity: Entity = harness.world.createEntity();
    harness.world.addComponent(entity, Transform2D);
    harness.world.addComponent(entity, SpriteRender, new Sprite(texture));
    harness.world.addComponent(entity, Animator, { walk: clip }, "walk");

    manager.setScale(entity, 0.5);

    harness.frame();

    const animator: Animator = harness.world.getComponent(
      entity,
      Animator,
    ) as Animator;
    expect(animator.currentFrame()).toBe(frames[0]);

    harness.frame();

    expect(animator.currentFrame()).toBe(frames[1]);
  });

  it("ignores a TimeScale component when the system was built without a TimeScaleManager", async () => {
    const harness: Harness = await createHarness();
    const texture: Texture2D = fakeTexture("sheet", 64, 32);
    const { clip, frames }: Clip = twoFrameClip();

    const entity: Entity = harness.world.createEntity();
    harness.world.addComponent(entity, Transform2D);
    harness.world.addComponent(entity, SpriteRender, new Sprite(texture));
    harness.world.addComponent(entity, Animator, { walk: clip }, "walk");
    harness.world.addComponent(entity, TimeScale, 0);

    const system: AnimatorSystem = new AnimatorSystem();
    system.update({ world: harness.world, dt: 0.15 });

    const animator: Animator = harness.world.getComponent(
      entity,
      Animator,
    ) as Animator;
    expect(animator.currentFrame()).toBe(frames[1]);
  });
});
