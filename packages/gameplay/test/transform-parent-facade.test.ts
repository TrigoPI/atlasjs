import { describe, expect, it } from "vitest";
import { Vec2, Transform2D as MathTransform2D } from "@atlasjs/math";
import { NexusWorld, Entity } from "@atlasjs/nexus";

import { Transform2D, WorldTransform2D } from "../src/components";
import { Transform2DComponent } from "../src/scripting/components";

function setup(): { world: NexusWorld } {
  const world: NexusWorld = new NexusWorld();
  world.defineComponent(Transform2D).defineComponent(WorldTransform2D);
  return { world };
}

describe("Transform2DComponent parenting", () => {
  it("setParent links the entities structurally", () => {
    const { world } = setup();
    const parentE: Entity = world.createEntity();
    const childE: Entity = world.createEntity();
    world.addComponent(parentE, Transform2D);
    world.addComponent(childE, Transform2D);

    const child: Transform2DComponent = new Transform2DComponent(world, childE);
    const parent: Transform2DComponent = new Transform2DComponent(world, parentE);
    child.setParent(parent);

    expect(world.getParent(childE)).toBe(parentE);
  });

  it("worldPositionStays recomputes the local transform to keep world position", () => {
    const { world } = setup();
    const parentE: Entity = world.createEntity();
    const childE: Entity = world.createEntity();

    world.addComponent(parentE, Transform2D);
    world
      .addComponent(parentE, WorldTransform2D)
      .matrix.fromTransform2D(new MathTransform2D(new Vec2(10, 0)));

    world.addComponent(childE, Transform2D);
    world.addComponent(childE, WorldTransform2D).matrix.identity();

    const child: Transform2DComponent = new Transform2DComponent(world, childE);
    const parent: Transform2DComponent = new Transform2DComponent(world, parentE);
    child.setParent(parent, true);

    const local: Transform2D = world.requireComponent(childE, Transform2D);
    expect(local.position.x).toBeCloseTo(-10, 5);
    expect(local.position.y).toBeCloseTo(0, 5);
  });

  it("worldPositionStays=false leaves the local transform untouched", () => {
    const { world } = setup();
    const parentE: Entity = world.createEntity();
    const childE: Entity = world.createEntity();
    world.addComponent(parentE, Transform2D);
    const local: Transform2D = world.addComponent(childE, Transform2D);
    local.position.set(5, 0);

    const child: Transform2DComponent = new Transform2DComponent(world, childE);
    const parent: Transform2DComponent = new Transform2DComponent(world, parentE);
    child.setParent(parent, false);

    expect(world.requireComponent(childE, Transform2D).position.x).toBe(5);
  });

  it("parent getter and getChildren resolve façades", () => {
    const { world } = setup();
    const parentE: Entity = world.createEntity();
    const childE: Entity = world.createEntity();
    world.addComponent(parentE, Transform2D);
    world.addComponent(childE, Transform2D);
    world.setParent(childE, parentE);

    const child: Transform2DComponent = new Transform2DComponent(world, childE);
    const parent: Transform2DComponent = new Transform2DComponent(world, parentE);

    expect(child.parent).not.toBeNull();
    expect(parent.getChildren().length).toBe(1);
  });
});
