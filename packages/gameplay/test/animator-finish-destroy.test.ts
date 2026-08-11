import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { Bound } from "@atlasjs/math";
import { Entity } from "@atlasjs/nexus";
import { SpriteAnimation, Frame } from "@atlasjs/nebula";

import { Animator, Sprite, SpriteRender, Transform2D } from "../src";
import { AtlasScript } from "../src/scripting";
import { createHarness, Harness } from "./helpers/harness";
import { fakeTexture } from "./helpers/fakes";

function oneShotClip(): SpriteAnimation {
  const texture = fakeTexture("sheet", 64, 32);
  const frames: Frame[] = Array.from(
    { length: 4 },
    (_: unknown, i: number) => new Frame(texture, new Bound(i * 16, 0, 16, 32)),
  );
  return new SpriteAnimation({ frames, fps: 10, loop: false, autoPlay: true });
}

function loopingClip(): SpriteAnimation {
  const texture = fakeTexture("sheet", 64, 32);
  const frames: Frame[] = Array.from(
    { length: 4 },
    (_: unknown, i: number) => new Frame(texture, new Bound(i * 16, 0, 16, 32)),
  );
  return new SpriteAnimation({ frames, fps: 10, loop: true, autoPlay: true });
}

class SelfDestructOnFinish extends AtlasScript {
  public onCreate(): void {
    this.requireComponent(Animator).on("finished", () => this.destroy());
  }
}

describe("Animator finished event drives a self-destructing particle", () => {
  let h: Harness;

  beforeEach(async () => {
    h = await createHarness();
  });

  afterEach(() => {
    h.physics.clear();
  });

  it("destroys the entity once its one-shot clip finishes", () => {
    const entity: Entity = h.world.createEntity();
    h.world.addComponent(entity, Transform2D);
    h.world.addComponent(entity, SpriteRender, new Sprite(fakeTexture()));
    h.world.addComponent(entity, Animator, { play: oneShotClip() }, "play");
    h.scripts.attach(entity, SelfDestructOnFinish);

    h.frame();
    expect(h.world.exists(entity)).toBe(true);

    h.frame();
    h.frame();

    expect(h.world.exists(entity)).toBe(false);
  });

  it("keeps a looping-clip entity alive (finished never fires)", () => {
    const entity: Entity = h.world.createEntity();
    h.world.addComponent(entity, Transform2D);
    h.world.addComponent(entity, SpriteRender, new Sprite(fakeTexture()));
    h.world.addComponent(entity, Animator, { play: loopingClip() }, "play");
    h.scripts.attach(entity, SelfDestructOnFinish);

    for (let i: number = 0; i < 10; i++) {
      h.frame();
    }

    expect(h.world.exists(entity)).toBe(true);
  });
});
