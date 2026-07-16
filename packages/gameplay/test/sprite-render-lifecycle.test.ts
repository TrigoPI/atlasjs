import { describe, expect, it } from "vitest";
import { NEBULA_RENDERER, NebulaRenderer } from "@atlasjs/nebula";
import { Sprite, SpriteRender, Transform2D } from "../src";
import { Entity } from "@atlasjs/nexus";
import { createHarness, Harness } from "./helpers/harness";
import { fakeTexture } from "./helpers/fakes";

function sceneChildCount(harness: Harness): number {
  const nebula: NebulaRenderer = harness.services.get(NEBULA_RENDERER);
  return nebula.scene.root.getChildren().length;
}

describe("sprite render lifecycle", () => {
  it("mounts on frame and unmounts on SpriteRender removal", async () => {
    const harness: Harness = await createHarness();
    const entity: Entity = harness.world.createEntity();
    harness.world.addComponent(entity, Transform2D);
    harness.world.addComponent(entity, SpriteRender, new Sprite(fakeTexture()));

    harness.frame();
    expect(sceneChildCount(harness)).toBe(1);

    harness.world.removeComponent(entity, SpriteRender);
    expect(sceneChildCount(harness)).toBe(0);
  });

  it("unmounts when the entity is destroyed", async () => {
    const harness: Harness = await createHarness();
    const entity: Entity = harness.world.createEntity();
    harness.world.addComponent(entity, Transform2D);
    harness.world.addComponent(entity, SpriteRender, new Sprite(fakeTexture()));

    harness.frame();
    expect(sceneChildCount(harness)).toBe(1);

    harness.world.destroyEntity(entity);
    expect(sceneChildCount(harness)).toBe(0);
  });
});
