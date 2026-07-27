import { describe, it, expect } from "vitest";
import { Transform2D, Vec2 } from "@atlasjs/math";
import { NebulaRenderer, Sampler, SceneGraph, SpriteNode } from "@atlasjs/nebula";
import { Entity, NexusWorld } from "@atlasjs/nexus";

import { Sprite } from "../src/assets";
import { SpriteRender, WorldTransform2D } from "../src/components";
import { SpriteRenderSystem } from "../src/systems";
import { SortingLayers } from "../src/rendering";
import { fakeTexture } from "./helpers/fakes";

function setup(layers: SortingLayers): {
  world: NexusWorld;
  scene: SceneGraph;
  system: SpriteRenderSystem;
} {
  const world: NexusWorld = new NexusWorld();
  world.defineComponent(WorldTransform2D).defineComponent(SpriteRender);

  const scene: SceneGraph = new SceneGraph();
  const nebula: NebulaRenderer = {
    scene,
    createSampler: (): Sampler => ({}) as Sampler,
  } as unknown as NebulaRenderer;

  return { world, scene, system: new SpriteRenderSystem(nebula, layers) };
}

function mount(
  world: NexusWorld,
  layer: string,
  order: number,
  transform: Transform2D,
): Entity {
  const entity: Entity = world.createEntity();
  world.addComponent(entity, WorldTransform2D).matrix.fromTransform2D(transform);
  const render: SpriteRender = world.addComponent(
    entity,
    SpriteRender,
    new Sprite(fakeTexture()),
  );
  render.sortingLayer = layer;
  render.sortingOrder = order;
  return entity;
}

describe("SpriteRenderSystem sorting layers", () => {
  it("in a ySorted layer, sortPrimary is world Y and sortSecondary is sortingOrder", () => {
    const layers: SortingLayers = new SortingLayers();
    layers.define([{ name: "Entities", mode: "ySorted" }]);
    const { world, scene, system } = setup(layers);
    mount(world, "Entities", 3, new Transform2D(new Vec2(10, 42)));

    system.update({ world, dt: 0 });

    const node: SpriteNode = scene.root.getChildren()[0] as SpriteNode;
    expect(node.sortingLayer).toBe(layers.indexOf("Entities"));
    expect(node.sortPrimary).toBeCloseTo(42, 4);
    expect(node.sortSecondary).toBe(3);
  });

  it("in a manual layer, sortPrimary is sortingOrder and sortSecondary is 0", () => {
    const layers: SortingLayers = new SortingLayers();
    layers.define([{ name: "Ground", mode: "manual" }]);
    const { world, scene, system } = setup(layers);
    mount(world, "Ground", 7, new Transform2D(new Vec2(0, 99)));

    system.update({ world, dt: 0 });

    const node: SpriteNode = scene.root.getChildren()[0] as SpriteNode;
    expect(node.sortingLayer).toBe(layers.indexOf("Ground"));
    expect(node.sortPrimary).toBe(7);
    expect(node.sortSecondary).toBe(0);
  });
});
