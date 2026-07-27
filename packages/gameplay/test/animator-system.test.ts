import { describe, it, expect } from "vitest";
import { Bound, Vec2 } from "@atlasjs/math";
import { Entity } from "@atlasjs/nexus";

import { Animator, Sprite, SpriteRender, Transform2D } from "../src";
import { AnimatorSystem } from "../src/systems";
import { createHarness, Harness } from "./helpers/harness";
import { fakeTexture } from "./helpers/fakes";

import {
  NEBULA_RENDERER,
  NebulaRenderer,
  SpriteNode as NebulaSprite,
  SpriteAnimation,
  Frame,
} from "@atlasjs/nebula";

function walkClip(): SpriteAnimation {
  const texture = fakeTexture("sheet", 64, 32);
  const frames: Frame[] = [
    new Frame(texture, new Bound(0, 0, 16, 32)),
    new Frame(texture, new Bound(16, 0, 16, 32)),
    new Frame(texture, new Bound(32, 0, 16, 32)),
  ];
  return new SpriteAnimation({ frames, fps: 10, loop: true, autoPlay: true });
}

describe("AnimatorSystem", () => {
  it("drives SpriteRender.sprite and the mounted node to the current frame", async () => {
    const harness: Harness = await createHarness();
    const texture = fakeTexture("sheet", 64, 32);

    const entity: Entity = harness.world.createEntity();
    harness.world.addComponent(entity, Transform2D);
    harness.world.addComponent(entity, SpriteRender, new Sprite(texture));
    harness.world.addComponent(entity, Animator, { walk: walkClip() }, "walk");

    harness.frame();

    const animator = harness.world.getComponent(entity, Animator) as Animator;
    const spriteRender = harness.world.getComponent(
      entity,
      SpriteRender,
    ) as SpriteRender;
    const frame: Frame = animator.currentFrame()!;

    expect(spriteRender.sprite.rect).toEqual(frame.rect);

    const nebula: NebulaRenderer = harness.services.get(NEBULA_RENDERER);
    const node: NebulaSprite = nebula.scene.root.getChildren()[0] as NebulaSprite;
    expect(node.getSourceRect()).toEqual(frame.rect);
  });

  it("reuses the same Sprite instance for an unchanged frame", async () => {
    const harness: Harness = await createHarness();
    const texture = fakeTexture("sheet", 64, 32);

    const entity: Entity = harness.world.createEntity();
    harness.world.addComponent(entity, Transform2D);
    harness.world.addComponent(entity, SpriteRender, new Sprite(texture));
    harness.world.addComponent(entity, Animator, { walk: walkClip() }, "walk");

    const system: AnimatorSystem = new AnimatorSystem();
    system.update({ world: harness.world, dt: 0 });
    const first: Sprite = (
      harness.world.getComponent(entity, SpriteRender) as SpriteRender
    ).sprite;
    system.update({ world: harness.world, dt: 0 });
    const second: Sprite = (
      harness.world.getComponent(entity, SpriteRender) as SpriteRender
    ).sprite;

    expect(second).toBe(first);
  });

  it("leaves entities without an Animator untouched", async () => {
    const harness: Harness = await createHarness();
    const texture = fakeTexture();
    const staticSprite = new Sprite(texture);

    const entity: Entity = harness.world.createEntity();
    harness.world.addComponent(entity, Transform2D);
    harness.world.addComponent(entity, SpriteRender, staticSprite);

    harness.frame();

    expect(
      (harness.world.getComponent(entity, SpriteRender) as SpriteRender).sprite,
    ).toBe(staticSprite);
  });

  it("forwards the frame pivot into the swapped Sprite", async () => {
    const harness: Harness = await createHarness();
    const texture = fakeTexture("sheet", 64, 32);
    const frames: Frame[] = [
      new Frame(texture, new Bound(0, 0, 16, 32), new Vec2(0.5, 1)),
    ];
    const clip: SpriteAnimation = new SpriteAnimation({
      frames,
      fps: 10,
      loop: true,
      autoPlay: true,
    });

    const entity: Entity = harness.world.createEntity();
    harness.world.addComponent(entity, Transform2D);
    harness.world.addComponent(entity, SpriteRender, new Sprite(texture));
    harness.world.addComponent(entity, Animator, { walk: clip }, "walk");

    harness.frame();

    const spriteRender = harness.world.getComponent(entity, SpriteRender) as SpriteRender;
    expect(spriteRender.sprite.pivot.x).toBe(0.5);
    expect(spriteRender.sprite.pivot.y).toBe(1);
  });
});
