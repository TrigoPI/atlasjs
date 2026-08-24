import { describe, expect, it } from "vitest";
import { Bound, Transform2D, Vec2 } from "@atlasjs/math";
import {
  Color,
  NEBULA_RENDERER,
  NebulaRenderer,
  Sampler,
  SceneGraph,
  SpriteNode,
} from "@atlasjs/nebula";
import { Entity, NexusWorld } from "@atlasjs/nexus";
import { Sprite } from "../src/assets";
import {
  AfterimageRenderer,
  SpriteRender,
  Transform2D as GameplayTransform2D,
  WorldTransform2D,
} from "../src/components";
import type { AfterimageRendererOptions } from "../src/components";
import { AfterimageRenderSystem } from "../src/systems";
import { SortingLayers } from "../src/rendering";
import { fakeTexture } from "./helpers/fakes";
import { createHarness } from "./helpers/harness";
import type { Harness } from "./helpers/harness";

function setup(sortingLayers: SortingLayers = new SortingLayers()): {
  world: NexusWorld;
  scene: SceneGraph;
  system: AfterimageRenderSystem;
} {
  const world: NexusWorld = new NexusWorld();
  world
    .defineComponent(WorldTransform2D)
    .defineComponent(SpriteRender)
    .defineComponent(AfterimageRenderer);

  const scene: SceneGraph = new SceneGraph();
  const nebula: NebulaRenderer = {
    scene,
    createSampler: (): Sampler => ({}) as Sampler,
  } as unknown as NebulaRenderer;

  return {
    world,
    scene,
    system: new AfterimageRenderSystem(nebula, sortingLayers),
  };
}

function mount(
  world: NexusWorld,
  options?: AfterimageRendererOptions,
  transform: Transform2D = new Transform2D(),
  sprite: Sprite = new Sprite(fakeTexture()),
): Entity {
  const entity: Entity = world.createEntity();
  world
    .addComponent(entity, WorldTransform2D)
    .matrix.fromTransform2D(transform);
  world.addComponent(entity, SpriteRender, sprite);
  world.addComponent(entity, AfterimageRenderer, options);
  return entity;
}

function place(
  world: NexusWorld,
  entity: Entity,
  transform: Transform2D,
): void {
  world
    .requireComponent(entity, WorldTransform2D)
    .matrix.fromTransform2D(transform);
}

function moveTo(world: NexusWorld, entity: Entity, x: number, y: number): void {
  place(world, entity, new Transform2D(new Vec2(x, y)));
}

function nodes(scene: SceneGraph): ReadonlyArray<SpriteNode> {
  return scene.root.getChildren() as ReadonlyArray<SpriteNode>;
}

function liveCount(scene: SceneGraph): number {
  let count: number = 0;

  for (const node of nodes(scene)) {
    if (node.visible) {
      count++;
    }
  }

  return count;
}

function ySortedLayers(): SortingLayers {
  return new SortingLayers().define([{ name: "Entities", mode: "ySorted" }]);
}

describe("AfterimageRenderSystem stamping", () => {
  it("mounts one SpriteNode per stamped image", () => {
    const { world, scene, system } = setup();
    mount(world, { interval: 0, time: 10 });

    expect(nodes(scene)).toHaveLength(0);

    system.update({ world, dt: 0.01 });

    expect(nodes(scene)).toHaveLength(1);
    expect(nodes(scene)[0]).toBeInstanceOf(SpriteNode);
    expect(liveCount(scene)).toBe(1);

    system.update({ world, dt: 0.01 });

    expect(liveCount(scene)).toBe(2);
  });

  it("waits for interval to elapse before the first stamp", () => {
    const { world, scene, system } = setup();
    mount(world, { interval: 0.1, time: 10 });

    system.update({ world, dt: 0.05 });
    expect(liveCount(scene)).toBe(0);

    system.update({ world, dt: 0.05 });
    expect(liveCount(scene)).toBe(1);

    system.update({ world, dt: 0.05 });
    expect(liveCount(scene)).toBe(1);

    system.update({ world, dt: 0.05 });
    expect(liveCount(scene)).toBe(2);
  });

  it("stamps nothing while emitting is false", () => {
    const { world, scene, system } = setup();
    mount(world, { interval: 0, time: 10, emitting: false });

    system.update({ world, dt: 0.01 });
    system.update({ world, dt: 0.01 });

    expect(liveCount(scene)).toBe(0);
  });

  it("freezes the world transform of the emitter, not its live value", () => {
    const { world, scene, system } = setup();
    const entity: Entity = mount(
      world,
      { interval: 0, time: 10 },
      new Transform2D(new Vec2(15, 4)),
    );

    system.update({ world, dt: 0.01 });

    const node: SpriteNode = nodes(scene)[0];
    expect(node.transform.position.x).toBeCloseTo(15, 4);
    expect(node.transform.position.y).toBeCloseTo(4, 4);

    world.requireComponent(entity, AfterimageRenderer).emitting = false;
    moveTo(world, entity, 900, 900);
    system.update({ world, dt: 0.01 });

    expect(node.transform.position.x).toBeCloseTo(15, 4);
    expect(node.transform.position.y).toBeCloseTo(4, 4);
  });

  it("folds flipX and flipY into the sign of the snapshot scale", () => {
    const { world, scene, system } = setup();
    const entity: Entity = mount(
      world,
      { interval: 0, time: 10 },
      new Transform2D(new Vec2(), new Vec2(3, 2)),
    );
    const render: SpriteRender = world.requireComponent(entity, SpriteRender);
    render.flipX = true;
    render.flipY = true;

    system.update({ world, dt: 0.01 });

    const node: SpriteNode = nodes(scene)[0];
    expect(node.transform.scale.x).toBeCloseTo(-3, 4);
    expect(node.transform.scale.y).toBeCloseTo(-2, 4);

    world.requireComponent(entity, AfterimageRenderer).emitting = false;
    render.flipX = false;
    render.flipY = false;
    system.update({ world, dt: 0.01 });

    expect(node.transform.scale.x).toBeCloseTo(-3, 4);
    expect(node.transform.scale.y).toBeCloseTo(-2, 4);
  });

  it("takes the pivot and the source rect from the sprite of the stamped frame", () => {
    const { world, scene, system } = setup();
    mount(
      world,
      { interval: 0, time: 10 },
      new Transform2D(),
      new Sprite(fakeTexture("sheet", 64, 32), {
        rect: new Bound(16, 0, 16, 32),
        pivot: new Vec2(0.5, 1),
      }),
    );

    system.update({ world, dt: 0.01 });

    const node: SpriteNode = nodes(scene)[0];
    expect(node.getSourceRect().x).toBe(16);
    expect(node.getSourceRect().width).toBe(16);
    expect(node.getAnchor().y).toBe(1);
  });

  it("rebuilds a pool node when its slot changes texture", () => {
    const { world, scene, system } = setup();
    const entity: Entity = mount(
      world,
      { interval: 0, time: 10, maxImages: 1 },
      new Transform2D(),
      new Sprite(fakeTexture("a")),
    );

    system.update({ world, dt: 0.01 });
    const first: SpriteNode = nodes(scene)[0];

    world.requireComponent(entity, SpriteRender).sprite = new Sprite(
      fakeTexture("b"),
    );
    system.update({ world, dt: 0.01 });

    expect(nodes(scene)).toHaveLength(1);
    expect(nodes(scene)[0]).not.toBe(first);
  });
});

describe("AfterimageRenderSystem minDistance guard", () => {
  it("does not stamp while the emitter has not moved far enough", () => {
    const { world, scene, system } = setup();
    mount(world, { interval: 0, minDistance: 10, time: 10 });

    system.update({ world, dt: 0.01 });
    expect(liveCount(scene)).toBe(1);

    system.update({ world, dt: 0.01 });
    system.update({ world, dt: 0.01 });
    expect(liveCount(scene)).toBe(1);
  });

  it("stamps on the very frame the emitter moves far enough, and only once (no catch-up burst)", () => {
    const { world, scene, system } = setup();
    const entity: Entity = mount(world, {
      interval: 0.1,
      minDistance: 10,
      time: 10,
    });

    system.update({ world, dt: 0.05 });
    system.update({ world, dt: 0.05 });
    expect(liveCount(scene)).toBe(1);

    for (let i: number = 0; i < 10; i++) {
      system.update({ world, dt: 0.05 });
    }

    expect(liveCount(scene)).toBe(1);

    moveTo(world, entity, 20, 0);
    system.update({ world, dt: 0.05 });

    expect(liveCount(scene)).toBe(2);
  });
});

describe("AfterimageRenderSystem lifetime", () => {
  it("expires an image when its age reaches time", () => {
    const { world, scene, system } = setup();
    const entity: Entity = mount(world, { interval: 0, time: 0.1 });

    system.update({ world, dt: 0 });
    expect(liveCount(scene)).toBe(1);

    world.requireComponent(entity, AfterimageRenderer).emitting = false;

    system.update({ world, dt: 0.05 });
    expect(liveCount(scene)).toBe(1);

    system.update({ world, dt: 0.05 });
    expect(liveCount(scene)).toBe(0);
  });

  it("expires the oldest image first", () => {
    const { world, scene, system } = setup();
    const entity: Entity = mount(world, { interval: 0, time: 0.1 });

    system.update({ world, dt: 0.05 });
    system.update({ world, dt: 0.05 });

    world.requireComponent(entity, AfterimageRenderer).emitting = false;

    expect(nodes(scene)).toHaveLength(2);
    expect(nodes(scene)[0].visible).toBe(false);
    expect(nodes(scene)[1].visible).toBe(true);
  });

  it("keeps no image when time is zero", () => {
    const { world, scene, system } = setup();
    mount(world, { interval: 0, time: 0 });

    system.update({ world, dt: 0.01 });
    system.update({ world, dt: 0.01 });

    expect(liveCount(scene)).toBe(0);
  });

  it("lets already stamped images fade out when emitting turns off", () => {
    const { world, scene, system } = setup();
    const entity: Entity = mount(world, { interval: 0, time: 10 });

    system.update({ world, dt: 0.01 });
    system.update({ world, dt: 0.01 });
    expect(liveCount(scene)).toBe(2);

    world.requireComponent(entity, AfterimageRenderer).emitting = false;
    system.update({ world, dt: 0.01 });

    expect(liveCount(scene)).toBe(2);
  });
});

describe("AfterimageRenderSystem fade", () => {
  it("interpolates the tint from startColor to endColor over the lifetime", () => {
    const { world, scene, system } = setup();
    const entity: Entity = mount(world, {
      interval: 0,
      time: 1,
      startColor: new Color(1, 1, 1, 1),
      endColor: new Color(0, 0, 0, 0),
    });

    system.update({ world, dt: 0 });

    const node: SpriteNode = nodes(scene)[0];
    expect(node.tint.x).toBeCloseTo(1, 6);
    expect(node.tint.w).toBeCloseTo(1, 6);

    world.requireComponent(entity, AfterimageRenderer).emitting = false;

    system.update({ world, dt: 0.5 });
    expect(node.tint.x).toBeCloseTo(0.5, 6);
    expect(node.tint.w).toBeCloseTo(0.5, 6);

    system.update({ world, dt: 0.499 });
    expect(node.tint.x).toBeCloseTo(0.001, 6);
    expect(node.tint.w).toBeCloseTo(0.001, 6);

    system.update({ world, dt: 0.01 });
    expect(node.visible).toBe(false);
  });

  it("replaces the tint of the source SpriteRender instead of multiplying it", () => {
    const { world, scene, system } = setup();
    const entity: Entity = mount(world, {
      interval: 0,
      time: 1,
      startColor: new Color(1, 1, 1, 1),
      endColor: new Color(0, 0, 0, 0),
    });
    world.requireComponent(entity, SpriteRender).color = new Color(
      1,
      0,
      0,
      0.5,
    );

    system.update({ world, dt: 0 });

    const node: SpriteNode = nodes(scene)[0];
    expect(node.tint.y).toBeCloseTo(1, 6);
    expect(node.tint.w).toBeCloseTo(1, 6);
  });
});

describe("AfterimageRenderSystem ring buffer", () => {
  it("overwrites the oldest image once maxImages is reached", () => {
    const { world, scene, system } = setup();
    const entity: Entity = mount(world, {
      interval: 0,
      time: 10,
      maxImages: 2,
    });

    system.update({ world, dt: 0.01 });
    moveTo(world, entity, 10, 0);
    system.update({ world, dt: 0.01 });
    moveTo(world, entity, 20, 0);
    system.update({ world, dt: 0.01 });

    expect(nodes(scene)).toHaveLength(2);
    expect(liveCount(scene)).toBe(2);
    expect(nodes(scene)[0].transform.position.x).toBeCloseTo(20, 4);
    expect(nodes(scene)[1].transform.position.x).toBeCloseTo(10, 4);
  });

  it("truncates maxImages to an integer", () => {
    const { world, scene, system } = setup();
    mount(world, { interval: 0, time: 10, maxImages: 3.7 });

    for (let i: number = 0; i < 10; i++) {
      system.update({ world, dt: 0.01 });
    }

    expect(nodes(scene)).toHaveLength(3);
  });

  it("clamps maxImages to at least one", () => {
    const zero = setup();
    mount(zero.world, { interval: 0, time: 10, maxImages: 0 });

    for (let i: number = 0; i < 5; i++) {
      zero.system.update({ world: zero.world, dt: 0.01 });
    }

    expect(nodes(zero.scene)).toHaveLength(1);

    const negative = setup();
    mount(negative.world, { interval: 0, time: 10, maxImages: -8 });

    for (let i: number = 0; i < 5; i++) {
      negative.system.update({ world: negative.world, dt: 0.01 });
    }

    expect(nodes(negative.scene)).toHaveLength(1);
  });

  it("clamps maxImages to 64", () => {
    const { world, scene, system } = setup();
    mount(world, { interval: 0, time: 10, maxImages: 1e6 });

    for (let i: number = 0; i < 100; i++) {
      system.update({ world, dt: 0.01 });
    }

    expect(nodes(scene)).toHaveLength(64);
  });

  it("clamps maxImages to 64 when it is +Infinity", () => {
    const { world, scene, system } = setup();
    mount(world, { interval: 0, time: 10, maxImages: Infinity });

    for (let i: number = 0; i < 100; i++) {
      system.update({ world, dt: 0.01 });
    }

    expect(nodes(scene)).toHaveLength(64);
  });

  it("empties the buffer and drops the surplus nodes when maxImages shrinks", () => {
    const { world, scene, system } = setup();
    const entity: Entity = mount(world, {
      interval: 0,
      time: 10,
      maxImages: 4,
    });

    for (let i: number = 0; i < 4; i++) {
      system.update({ world, dt: 0.01 });
    }

    expect(nodes(scene)).toHaveLength(4);

    world.requireComponent(entity, AfterimageRenderer).maxImages = 2;
    system.update({ world, dt: 0.01 });

    expect(nodes(scene)).toHaveLength(2);
    expect(liveCount(scene)).toBe(1);
  });
});

describe("AfterimageRenderSystem commands and visibility", () => {
  it("empties the buffer on the rising edge of emitting", () => {
    const { world, scene, system } = setup();
    const entity: Entity = mount(world, { interval: 0, time: 10 });
    const renderer: AfterimageRenderer = world.requireComponent(
      entity,
      AfterimageRenderer,
    );

    system.update({ world, dt: 0.01 });
    system.update({ world, dt: 0.01 });
    system.update({ world, dt: 0.01 });
    expect(liveCount(scene)).toBe(3);

    renderer.emitting = false;
    system.update({ world, dt: 0.01 });
    expect(liveCount(scene)).toBe(3);

    renderer.emitting = true;
    system.update({ world, dt: 0.01 });
    expect(liveCount(scene)).toBe(1);
  });

  it("stamps on the very frame emission resumes after the buffer is emptied, regardless of inherited timing", () => {
    const { world, scene, system } = setup();
    const entity: Entity = mount(world, { interval: 0.1, time: 10 });
    const renderer: AfterimageRenderer = world.requireComponent(
      entity,
      AfterimageRenderer,
    );

    system.update({ world, dt: 0.09 });
    expect(liveCount(scene)).toBe(0);

    renderer.emitting = false;
    system.update({ world, dt: 0.01 });

    renderer.emitting = true;
    system.update({ world, dt: 0.001 });

    expect(liveCount(scene)).toBe(1);
  });

  it("does not empty the buffer while emitting stays true", () => {
    const { world, scene, system } = setup();
    mount(world, { interval: 0, time: 10 });

    system.update({ world, dt: 0.01 });
    system.update({ world, dt: 0.01 });
    system.update({ world, dt: 0.01 });

    expect(liveCount(scene)).toBe(3);
  });

  it("clear() empties the buffer and resets the command back to none", () => {
    const { world, scene, system } = setup();
    const entity: Entity = mount(world, { interval: 0, time: 10 });
    const renderer: AfterimageRenderer = world.requireComponent(
      entity,
      AfterimageRenderer,
    );

    system.update({ world, dt: 0.01 });
    system.update({ world, dt: 0.01 });
    expect(liveCount(scene)).toBe(2);

    renderer.emitting = false;
    system.update({ world, dt: 0.01 });
    expect(liveCount(scene)).toBe(2);

    renderer.clear();
    expect(renderer.command).toBe("clear");

    system.update({ world, dt: 0.01 });

    expect(liveCount(scene)).toBe(0);
    expect(renderer.command).toBe("none");
  });

  it("hides every image when visible is false without emptying the buffer", () => {
    const { world, scene, system } = setup();
    const entity: Entity = mount(world, { interval: 0, time: 10 });
    const renderer: AfterimageRenderer = world.requireComponent(
      entity,
      AfterimageRenderer,
    );

    system.update({ world, dt: 0.01 });
    system.update({ world, dt: 0.01 });
    renderer.emitting = false;

    renderer.visible = false;
    system.update({ world, dt: 0.01 });
    expect(liveCount(scene)).toBe(0);
    expect(nodes(scene)).toHaveLength(2);

    renderer.visible = true;
    system.update({ world, dt: 0.01 });
    expect(liveCount(scene)).toBe(2);
  });
});

describe("AfterimageRenderSystem sorting", () => {
  it("sorts each image on its own Y, not the emitter's", () => {
    const { world, scene, system } = setup(ySortedLayers());
    const entity: Entity = mount(
      world,
      { interval: 0, time: 10, sortingLayer: "Entities", sortingOrder: 7 },
      new Transform2D(new Vec2(0, 100)),
    );

    system.update({ world, dt: 0.01 });
    moveTo(world, entity, 0, 50);
    system.update({ world, dt: 0.01 });

    expect(nodes(scene)[0].sortPrimary).toBeCloseTo(100, 4);
    expect(nodes(scene)[1].sortPrimary).toBeCloseTo(50, 4);
    expect(nodes(scene)[0].sortSecondary).toBe(7);
  });
});

describe("AfterimageRenderSystem lifecycle", () => {
  it("keeps ageing a detached emitter's images, then removes their nodes", () => {
    const { world, scene, system } = setup();
    const entity: Entity = mount(world, { interval: 0, time: 0.1 });

    system.update({ world, dt: 0.05 });
    expect(nodes(scene)).toHaveLength(1);

    const node: SpriteNode = nodes(scene)[0];
    const tintBeforeDetach: number = node.tint.w;

    system.detach(entity);
    world.destroyEntity(entity);

    expect(nodes(scene)).toHaveLength(1);

    system.update({ world, dt: 0.02 });
    expect(nodes(scene)).toHaveLength(1);
    expect(liveCount(scene)).toBe(1);
    expect(node.tint.w).toBeLessThan(tintBeforeDetach);

    system.update({ world, dt: 0.05 });
    expect(nodes(scene)).toHaveLength(0);
  });

  it("stamps nothing new on a detached emitter", () => {
    const { world, scene, system } = setup();
    const entity: Entity = mount(world, { interval: 0, time: 10 });

    system.update({ world, dt: 0.01 });
    system.detach(entity);
    world.destroyEntity(entity);

    system.update({ world, dt: 0.01 });
    system.update({ world, dt: 0.01 });

    expect(nodes(scene)).toHaveLength(1);
    expect(liveCount(scene)).toBe(1);
  });

  it("clear() removes the remaining detached nodes", () => {
    const { world, scene, system } = setup();
    const entity: Entity = mount(world, { interval: 0, time: 10 });

    system.update({ world, dt: 0.01 });
    system.detach(entity);
    system.clear();

    expect(nodes(scene)).toHaveLength(0);
  });

  it("detaching an unknown entity is a no-op", () => {
    const { world, system } = setup();

    expect(() => system.detach(world.createEntity())).not.toThrow();
  });
});

describe("GameplayPlugin afterimage wiring", () => {
  it("defines AfterimageRenderer and registers the render step", async () => {
    const harness: Harness = await createHarness();
    const entity: Entity = harness.world.createEntity();

    expect(() =>
      harness.world.addComponent(entity, AfterimageRenderer),
    ).not.toThrow();
    expect(() => harness.frame()).not.toThrow();
    expect(() =>
      harness.world.removeComponent(entity, AfterimageRenderer),
    ).not.toThrow();
  });

  it("detaches and fades out afterimages when SpriteRender is removed while AfterimageRenderer stays", async () => {
    const harness: Harness = await createHarness();
    const nebula: NebulaRenderer = harness.services.get(NEBULA_RENDERER);
    const entity: Entity = harness.world.createEntity();

    harness.world.addComponent(entity, GameplayTransform2D);
    harness.world.addComponent(entity, SpriteRender, new Sprite(fakeTexture()));
    harness.world.addComponent(entity, AfterimageRenderer, {
      interval: 0,
      time: 1,
    });

    harness.frame();
    const spawned: ReadonlyArray<SpriteNode> =
      nebula.scene.root.getChildren() as ReadonlyArray<SpriteNode>;
    expect(spawned.some((node: SpriteNode) => node.visible)).toBe(true);

    harness.world.removeComponent(entity, SpriteRender);

    for (let i: number = 0; i < 20; i++) {
      harness.frame();

      if (nebula.scene.root.getChildren().length === 0) {
        break;
      }
    }

    expect(nebula.scene.root.getChildren()).toHaveLength(0);
  });
});
