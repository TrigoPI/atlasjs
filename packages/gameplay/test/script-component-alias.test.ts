import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { Entity } from "@atlasjs/nexus";

import { Sprite } from "@atlasjs/nebula";
import { RigidBody2D, SpriteRender } from "../src/components";
import { AtlasScript, RigidBody, SpriteRenderer } from "../src/scripting";
import { createHarness, Harness } from "./helpers/harness";

const sprite: Sprite = { texture: null } as unknown as Sprite;

class AliasProbe extends AtlasScript {
  public spriteRenderer!: SpriteRender;
  public rigidbody!: RigidBody2D;

  public onCreate(): void {
    this.spriteRenderer = this.addComponent(SpriteRenderer, sprite);
    this.rigidbody = this.addComponent(RigidBody);
  }
}

describe("Gameplay — script component aliases (raw engine components)", () => {
  let h: Harness;

  beforeEach(async () => {
    h = await createHarness();
  });

  afterEach(() => {
    h.physics.clear();
  });

  it("addComponent(SpriteRenderer, sprite) returns the raw SpriteRender", () => {
    const e: Entity = h.world.createEntity();
    const probe: AliasProbe = h.scripts.attach(e, AliasProbe);

    h.frame();

    expect(probe.spriteRenderer).toBeInstanceOf(SpriteRender);
    expect(h.world.requireComponent(e, SpriteRender)).toBe(probe.spriteRenderer);
  });

  it("addComponent(RigidBody) returns the raw RigidBody2D", () => {
    const e: Entity = h.world.createEntity();
    const probe: AliasProbe = h.scripts.attach(e, AliasProbe);

    h.frame();

    expect(probe.rigidbody).toBeInstanceOf(RigidBody2D);
    expect(h.world.requireComponent(e, RigidBody2D)).toBe(probe.rigidbody);
  });
});
