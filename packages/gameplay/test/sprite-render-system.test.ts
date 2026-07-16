import { describe, expect, it } from "vitest";
import { Bound } from "@atlasjs/math";
import {
  Color,
  NebulaRenderer,
  Sampler,
  SceneGraph,
  Sprite as SpriteNode,
} from "@atlasjs/nebula";
import { Entity, NexusWorld } from "@atlasjs/nexus";
import { Sprite } from "../src/assets";
import { SpriteRender, Transform2D } from "../src/components";
import { SpriteRenderSystem } from "../src/systems";
import { fakeTexture } from "./helpers/fakes";

function setup(): {
  world: NexusWorld;
  scene: SceneGraph;
  system: SpriteRenderSystem;
} {
  const world: NexusWorld = new NexusWorld();
  world.defineComponent(Transform2D).defineComponent(SpriteRender);

  const scene: SceneGraph = new SceneGraph();
  const nebula: NebulaRenderer = {
    scene,
    createSampler: (): Sampler => ({}) as Sampler,
  } as unknown as NebulaRenderer;

  return { world, scene, system: new SpriteRenderSystem(nebula) };
}

function children(scene: SceneGraph): ReadonlyArray<SpriteNode> {
  return scene.root.getChildren() as ReadonlyArray<SpriteNode>;
}

describe("SpriteRenderSystem", () => {
  it("mounts one scene node per SpriteRender entity", () => {
    const { world, scene, system } = setup();
    const entity: Entity = world.createEntity();
    world.addComponent(entity, Transform2D);
    world.addComponent(entity, SpriteRender, new Sprite(fakeTexture()));

    system.update({ world, dt: 0 });

    expect(children(scene).length).toBe(1);
  });

  it("applies flip as the sign of the transform scale", () => {
    const { world, scene, system } = setup();
    const entity: Entity = world.createEntity();
    world.addComponent(entity, Transform2D);
    world.addComponent(entity, SpriteRender, new Sprite(fakeTexture()));

    world.requireComponent(entity, Transform2D).scale.set(3, 2);
    world.requireComponent(entity, SpriteRender).flipX = true;

    system.update({ world, dt: 0 });

    const node: SpriteNode = children(scene)[0];
    expect(node.transform.scale.x).toBe(-3);
    expect(node.transform.scale.y).toBe(2);
  });

  it("propagates tint, visibility and sorting order", () => {
    const { world, scene, system } = setup();
    const entity: Entity = world.createEntity();
    world.addComponent(entity, Transform2D);
    world.addComponent(entity, SpriteRender, new Sprite(fakeTexture()));

    const render: SpriteRender = world.requireComponent(entity, SpriteRender);
    render.color = Color.Red();
    render.visible = false;
    render.sortingOrder = 4;

    system.update({ world, dt: 0 });

    const node: SpriteNode = children(scene)[0];
    expect(node.tint.x).toBe(1);
    expect(node.tint.y).toBe(0);
    expect(node.visible).toBe(false);
    expect(node.zIndex).toBe(4);
  });

  it("reuses the node on a same-texture rect swap", () => {
    const { world, scene, system } = setup();
    const texture = fakeTexture("shared", 64, 64);
    const entity: Entity = world.createEntity();
    world.addComponent(entity, Transform2D);
    world.addComponent(entity, SpriteRender, new Sprite(texture));

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
    const entity: Entity = world.createEntity();
    world.addComponent(entity, Transform2D);
    world.addComponent(entity, SpriteRender, new Sprite(fakeTexture("a")));

    system.update({ world, dt: 0 });
    const first: SpriteNode = children(scene)[0];

    world.requireComponent(entity, SpriteRender).sprite = new Sprite(fakeTexture("b"));
    system.update({ world, dt: 0 });

    expect(children(scene).length).toBe(1);
    expect(children(scene)[0]).not.toBe(first);
  });

  it("unmount removes the node from the scene", () => {
    const { world, scene, system } = setup();
    const entity: Entity = world.createEntity();
    world.addComponent(entity, Transform2D);
    world.addComponent(entity, SpriteRender, new Sprite(fakeTexture()));

    system.update({ world, dt: 0 });
    expect(children(scene).length).toBe(1);

    system.unmount(entity);
    expect(children(scene).length).toBe(0);
  });
});
