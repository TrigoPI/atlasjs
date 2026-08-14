import { describe, expect, it } from "vitest";
import { Bound, Transform2D, Vec2 } from "@atlasjs/math";
import {
  Color,
  NebulaRenderer,
  Sampler,
  SceneGraph,
  SpriteNode,
} from "@atlasjs/nebula";
import { Entity, NexusWorld } from "@atlasjs/nexus";
import { Sprite } from "../src/assets";
import { SpriteRender, WorldTransform2D } from "../src/components";
import { SpriteRenderSystem } from "../src/systems";
import { SortingLayers } from "../src/rendering";
import { fakeTexture } from "./helpers/fakes";

function setup(sortingLayers: SortingLayers = new SortingLayers()): {
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

  return {
    world,
    scene,
    system: new SpriteRenderSystem(nebula, sortingLayers),
  };
}

function mount(
  world: NexusWorld,
  sprite: Sprite,
  transform: Transform2D = new Transform2D(),
): Entity {
  const entity: Entity = world.createEntity();
  world
    .addComponent(entity, WorldTransform2D)
    .matrix.fromTransform2D(transform);
  world.addComponent(entity, SpriteRender, sprite);
  return entity;
}

function children(scene: SceneGraph): ReadonlyArray<SpriteNode> {
  return scene.root.getChildren() as ReadonlyArray<SpriteNode>;
}

describe("SpriteRenderSystem", () => {
  it("mounts one scene node per SpriteRender entity", () => {
    const { world, scene, system } = setup();
    mount(world, new Sprite(fakeTexture()));

    system.update({ world, dt: 0 });

    expect(children(scene).length).toBe(1);
  });

  it("positions the node at the world transform", () => {
    const { world, scene, system } = setup();
    mount(world, new Sprite(fakeTexture()), new Transform2D(new Vec2(15, 4)));

    system.update({ world, dt: 0 });

    const node: SpriteNode = children(scene)[0];
    expect(node.transform.position.x).toBeCloseTo(15, 4);
    expect(node.transform.position.y).toBeCloseTo(4, 4);
  });

  it("applies flip as the sign of the world scale", () => {
    const { world, scene, system } = setup();
    const entity: Entity = mount(
      world,
      new Sprite(fakeTexture()),
      new Transform2D(new Vec2(), new Vec2(3, 2)),
    );
    world.requireComponent(entity, SpriteRender).flipX = true;

    system.update({ world, dt: 0 });

    const node: SpriteNode = children(scene)[0];
    expect(node.transform.scale.x).toBeCloseTo(-3, 4);
    expect(node.transform.scale.y).toBeCloseTo(2, 4);
  });

  it("propagates tint, visibility and sorting order", () => {
    const { world, scene, system } = setup();
    const entity: Entity = mount(world, new Sprite(fakeTexture()));

    const render: SpriteRender = world.requireComponent(entity, SpriteRender);
    render.color = Color.Red();
    render.visible = false;
    render.sortingOrder = 4;

    system.update({ world, dt: 0 });

    const node: SpriteNode = children(scene)[0];
    expect(node.tint.x).toBe(1);
    expect(node.tint.y).toBe(0);
    expect(node.visible).toBe(false);
    expect(node.sortPrimary).toBe(4);
  });

  it("reuses the node on a same-texture rect swap", () => {
    const { world, scene, system } = setup();
    const texture = fakeTexture("shared", 64, 64);
    const entity: Entity = mount(world, new Sprite(texture));

    system.update({ world, dt: 0 });
    const first: SpriteNode = children(scene)[0];

    world.requireComponent(entity, SpriteRender).sprite = new Sprite(texture, {
      rect: new Bound(0, 0, 16, 16),
    });
    system.update({ world, dt: 0 });

    expect(children(scene).length).toBe(1);
    expect(children(scene)[0]).toBe(first);
    expect(first.getSourceRect().width).toBe(16);
  });

  it("rebuilds the node on a different-texture swap", () => {
    const { world, scene, system } = setup();
    const entity: Entity = mount(world, new Sprite(fakeTexture("a")));

    system.update({ world, dt: 0 });
    const first: SpriteNode = children(scene)[0];

    world.requireComponent(entity, SpriteRender).sprite = new Sprite(
      fakeTexture("b"),
    );
    system.update({ world, dt: 0 });

    expect(children(scene).length).toBe(1);
    expect(children(scene)[0]).not.toBe(first);
  });

  it("unmount removes the node from the scene", () => {
    const { world, scene, system } = setup();
    const entity: Entity = mount(world, new Sprite(fakeTexture()));

    system.update({ world, dt: 0 });
    expect(children(scene).length).toBe(1);

    system.unmount(entity);
    expect(children(scene).length).toBe(0);
  });
});

function ySortedLayers(): SortingLayers {
  return new SortingLayers().define([{ name: "Entities", mode: "ySorted" }]);
}

function anchorAt(world: NexusWorld, y: number): Entity {
  const entity: Entity = world.createEntity();
  world
    .addComponent(entity, WorldTransform2D)
    .matrix.fromTransform2D(new Transform2D(new Vec2(0, y)));
  return entity;
}

describe("SpriteRenderSystem sort point anchor", () => {
  it("resolves sortPrimary from the carrier's world Y on a ySorted layer", () => {
    const { world, scene, system } = setup(ySortedLayers());
    const carrier: Entity = anchorAt(world, 100);
    const sword: Entity = mount(
      world,
      new Sprite(fakeTexture()),
      new Transform2D(new Vec2(0, 80)),
    );
    const render: SpriteRender = world.requireComponent(sword, SpriteRender);
    render.sortingLayer = "Entities";
    render.sortPointEntity = carrier;

    system.update({ world, dt: 0 });

    const node: SpriteNode = children(scene)[0];
    expect(node.sortPrimary).toBe(100);
  });

  it("stacks the accessory above its carrier via sortingOrder at the shared Y", () => {
    const { world, scene, system } = setup(ySortedLayers());
    const player: Entity = mount(
      world,
      new Sprite(fakeTexture()),
      new Transform2D(new Vec2(0, 100)),
    );
    const playerRender: SpriteRender = world.requireComponent(
      player,
      SpriteRender,
    );
    playerRender.sortingLayer = "Entities";
    playerRender.sortingOrder = 10;

    const sword: Entity = mount(
      world,
      new Sprite(fakeTexture()),
      new Transform2D(new Vec2(0, 80)),
    );
    const swordRender: SpriteRender = world.requireComponent(
      sword,
      SpriteRender,
    );
    swordRender.sortingLayer = "Entities";
    swordRender.sortingOrder = 20;
    swordRender.sortPointEntity = player;

    system.update({ world, dt: 0 });

    const playerNode: SpriteNode = children(scene)[0];
    const swordNode: SpriteNode = children(scene)[1];
    expect(swordNode.sortPrimary).toBe(playerNode.sortPrimary);
    expect(swordNode.sortSecondary).toBeGreaterThan(playerNode.sortSecondary);
  });

  it("falls back to its own world Y when the carrier has no WorldTransform2D", () => {
    const { world, scene, system } = setup(ySortedLayers());
    const orphan: Entity = world.createEntity();
    const sword: Entity = mount(
      world,
      new Sprite(fakeTexture()),
      new Transform2D(new Vec2(0, 80)),
    );
    const render: SpriteRender = world.requireComponent(sword, SpriteRender);
    render.sortingLayer = "Entities";
    render.sortPointEntity = orphan;

    system.update({ world, dt: 0 });

    const node: SpriteNode = children(scene)[0];
    expect(node.sortPrimary).toBe(80);
  });

  it("falls back to its own world Y when the carrier was destroyed", () => {
    const { world, scene, system } = setup(ySortedLayers());
    const carrier: Entity = anchorAt(world, 100);
    const sword: Entity = mount(
      world,
      new Sprite(fakeTexture()),
      new Transform2D(new Vec2(0, 80)),
    );
    const render: SpriteRender = world.requireComponent(sword, SpriteRender);
    render.sortingLayer = "Entities";
    render.sortPointEntity = carrier;

    world.destroyEntity(carrier);

    expect(() => system.update({ world, dt: 0 })).not.toThrow();
    const node: SpriteNode = children(scene)[0];
    expect(node.sortPrimary).toBe(80);
  });
});
