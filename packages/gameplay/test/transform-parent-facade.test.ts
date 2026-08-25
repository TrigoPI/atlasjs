import { describe, expect, it } from "vitest";
import { Vec2, Transform2D as MathTransform2D } from "@atlasjs/math";
import { NexusWorld, Entity } from "@atlasjs/nexus";

import { RigidBody2D, Transform2D, WorldTransform2D } from "../src/components";
import { Transform } from "../src/scripting/components";

function setup(): { world: NexusWorld } {
  const world: NexusWorld = new NexusWorld();
  world
    .defineComponent(Transform2D)
    .defineComponent(WorldTransform2D)
    .defineComponent(RigidBody2D);
  return { world };
}

function addLocal(
  world: NexusWorld,
  entity: Entity,
  x: number,
  y: number,
  rotation: number = 0,
): Transform2D {
  const local: Transform2D = world.addComponent(entity, Transform2D);
  local.position.set(x, y);
  local.rotation = rotation;
  return local;
}

describe("Transform parenting", () => {
  it("setParent links the entities structurally", () => {
    const { world } = setup();
    const parentE: Entity = world.createEntity();
    const childE: Entity = world.createEntity();
    world.addComponent(parentE, Transform2D);
    world.addComponent(childE, Transform2D);

    const child: Transform = Transform.create(world, childE);
    const parent: Transform = Transform.create(world, parentE);
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

    const child: Transform = Transform.create(world, childE);
    const parent: Transform = Transform.create(world, parentE);
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

    const child: Transform = Transform.create(world, childE);
    const parent: Transform = Transform.create(world, parentE);
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

    const child: Transform = Transform.create(world, childE);
    const parent: Transform = Transform.create(world, parentE);

    expect(child.parent).not.toBeNull();
    expect(parent.getChildren().length).toBe(1);
  });
});

describe("Transform world position before the propagation stage", () => {
  it("reports the parent world position for a child without WorldTransform2D", () => {
    const { world } = setup();
    const parentE: Entity = world.createEntity();
    const childE: Entity = world.createEntity();

    addLocal(world, parentE, 10, 5);
    addLocal(world, childE, 0, 0);
    world.setParent(childE, parentE);

    const child: Transform = Transform.create(world, childE);
    const position: Vec2 = child.worldPosition;

    expect(position.x).toBeCloseTo(10, 5);
    expect(position.y).toBeCloseTo(5, 5);
  });

  it("composes a rotated chain over two levels of depth", () => {
    const { world } = setup();
    const grandParentE: Entity = world.createEntity();
    const parentE: Entity = world.createEntity();
    const childE: Entity = world.createEntity();

    addLocal(world, grandParentE, 0, 0, Math.PI / 2);
    addLocal(world, parentE, 10, 0);
    addLocal(world, childE, 5, 0);

    world.setParent(parentE, grandParentE);
    world.setParent(childE, parentE);

    const child: Transform = Transform.create(world, childE);
    const position: Vec2 = child.worldPosition;

    expect(position.x).toBeCloseTo(0, 5);
    expect(position.y).toBeCloseTo(15, 5);
  });

  it("keeps world = local for a parented dynamic body", () => {
    const { world } = setup();
    const parentE: Entity = world.createEntity();
    const childE: Entity = world.createEntity();

    addLocal(world, parentE, 10, 5);
    addLocal(world, childE, 2, 3);
    world.addComponent(childE, RigidBody2D).type = "dynamic";
    world.setParent(childE, parentE);

    const child: Transform = Transform.create(world, childE);
    const position: Vec2 = child.worldPosition;

    expect(position.x).toBeCloseTo(2, 5);
    expect(position.y).toBeCloseTo(3, 5);
  });

  it("stops at the first cached ancestor instead of recomposing its locals", () => {
    const { world } = setup();
    const parentE: Entity = world.createEntity();
    const childE: Entity = world.createEntity();

    addLocal(world, parentE, 10, 0);
    world
      .addComponent(parentE, WorldTransform2D)
      .matrix.fromTransform2D(new MathTransform2D(new Vec2(40, 3)));

    addLocal(world, childE, 1, 1);
    world.setParent(childE, parentE);

    const child: Transform = Transform.create(world, childE);
    const position: Vec2 = child.worldPosition;

    expect(position.x).toBeCloseTo(41, 5);
    expect(position.y).toBeCloseTo(4, 5);
  });

  it("walks through an ancestor that carries no Transform2D", () => {
    const { world } = setup();
    const grandParentE: Entity = world.createEntity();
    const middleE: Entity = world.createEntity();
    const childE: Entity = world.createEntity();

    addLocal(world, grandParentE, 100, 0);
    addLocal(world, childE, 1, 0);

    world.setParent(middleE, grandParentE);
    world.setParent(childE, middleE);

    const child: Transform = Transform.create(world, childE);
    const position: Vec2 = child.worldPosition;

    expect(position.x).toBeCloseTo(101, 5);
    expect(position.y).toBeCloseTo(0, 5);
  });

  it("setParent with worldPositionStays keeps the world position without any cache", () => {
    const { world } = setup();
    const grandParentE: Entity = world.createEntity();
    const parentE: Entity = world.createEntity();
    const childE: Entity = world.createEntity();

    addLocal(world, grandParentE, 100, 0);
    addLocal(world, parentE, 10, 0);
    addLocal(world, childE, 3, 0);
    world.setParent(parentE, grandParentE);

    const child: Transform = Transform.create(world, childE);
    const parent: Transform = Transform.create(world, parentE);
    child.setParent(parent, true);

    const local: Transform2D = world.requireComponent(childE, Transform2D);
    expect(local.position.x).toBeCloseTo(-107, 4);
    expect(local.position.y).toBeCloseTo(0, 4);
    expect(child.worldPosition.x).toBeCloseTo(3, 4);
  });

  it("leaves the cached WorldTransform2D authoritative when it exists", () => {
    const { world } = setup();
    const parentE: Entity = world.createEntity();
    const childE: Entity = world.createEntity();

    addLocal(world, parentE, 10, 0);
    addLocal(world, childE, 1, 1);
    world
      .addComponent(childE, WorldTransform2D)
      .matrix.fromTransform2D(new MathTransform2D(new Vec2(99, 7)));
    world.setParent(childE, parentE);

    const child: Transform = Transform.create(world, childE);
    const position: Vec2 = child.worldPosition;

    expect(position.x).toBeCloseTo(99, 5);
    expect(position.y).toBeCloseTo(7, 5);
  });

  it("does not corrupt the cached parent matrix when setParent reads it", () => {
    const { world } = setup();
    const parentE: Entity = world.createEntity();
    const childE: Entity = world.createEntity();

    addLocal(world, parentE, 10, 0);
    const parentWorld: WorldTransform2D = world.addComponent(
      parentE,
      WorldTransform2D,
    );
    parentWorld.matrix.fromTransform2D(new MathTransform2D(new Vec2(10, 0)));

    addLocal(world, childE, 3, 0);

    const child: Transform = Transform.create(world, childE);
    const parent: Transform = Transform.create(world, parentE);
    child.setParent(parent, true);

    const cached: Vec2 = parentWorld.getPosition();
    expect(cached.x).toBeCloseTo(10, 5);
    expect(cached.y).toBeCloseTo(0, 5);
  });
});
