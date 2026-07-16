import { beforeEach, describe, expect, it } from "vitest";
import { Color } from "@atlasjs/nebula";
import { Entity, NexusWorld } from "@atlasjs/nexus";
import { Sprite } from "../src/assets";
import { SpriteRender } from "../src/components";
import { SpriteRendererComponent } from "../src/scripting/components";
import { fakeTexture } from "./helpers/fakes";

describe("SpriteRendererComponent facade", () => {
  let world: NexusWorld;
  let entity: Entity;

  beforeEach(() => {
    world = new NexusWorld();
    world.defineComponent(SpriteRender);
    entity = world.createEntity();
    world.addComponent(entity, SpriteRender, new Sprite(fakeTexture()));
  });

  it("writes through to the SpriteRender source of truth", () => {
    const facade: SpriteRendererComponent = new SpriteRendererComponent(world, entity);
    const swapped: Sprite = new Sprite(fakeTexture("swapped"));

    facade.flipX = true;
    facade.sortingOrder = 5;
    facade.color = Color.Red();
    facade.visible = false;
    facade.sprite = swapped;

    const render: SpriteRender = world.requireComponent(entity, SpriteRender);
    expect(render.flipX).toBe(true);
    expect(render.sortingOrder).toBe(5);
    expect(render.color.r).toBe(1);
    expect(render.color.g).toBe(0);
    expect(render.visible).toBe(false);
    expect(render.sprite).toBe(swapped);
  });

  it("supports fluent setters", () => {
    const facade: SpriteRendererComponent = new SpriteRendererComponent(world, entity);
    const swapped: Sprite = new Sprite(fakeTexture("fluent"));

    facade
      .setSprite(swapped)
      .setColor(0, 1, 0)
      .setFlip(false, true)
      .setVisible(false)
      .setSortingOrder(3);

    const render: SpriteRender = world.requireComponent(entity, SpriteRender);
    expect(render.sprite).toBe(swapped);
    expect(render.color.g).toBe(1);
    expect(render.flipX).toBe(false);
    expect(render.flipY).toBe(true);
    expect(render.visible).toBe(false);
    expect(render.sortingOrder).toBe(3);
  });

  it("is stateless — re-resolves the live component on each access", () => {
    const facade: SpriteRendererComponent = new SpriteRendererComponent(world, entity);

    world.removeComponent(entity, SpriteRender);
    world.addComponent(entity, SpriteRender, new Sprite(fakeTexture()), Color.Blue());

    expect(facade.color.r).toBe(0);
    expect(facade.color.b).toBe(1);
  });
});
