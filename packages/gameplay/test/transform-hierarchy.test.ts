import { describe, expect, it } from "vitest";

import { NexusWorld, Entity } from "@atlasjs/nexus";

import { RigidBody2D, Transform2D, WorldTransform2D } from "../src/components";
import { TransformPropagationSystem } from "../src/systems";

function setup(): { world: NexusWorld; system: TransformPropagationSystem } {
  const world: NexusWorld = new NexusWorld();
  world
    .defineComponent(Transform2D)
    .defineComponent(WorldTransform2D)
    .defineComponent(RigidBody2D);
  return { world, system: new TransformPropagationSystem() };
}

describe("TransformPropagationSystem", () => {
  it("root world transform equals its local transform", () => {
    const { world, system } = setup();
    const e: Entity = world.createEntity();
    world.addComponent(e, Transform2D).position.set(5, 7);

    system.update({ world, dt: 0 });

    const w: WorldTransform2D = world.requireComponent(e, WorldTransform2D);
    expect(w.getPosition().x).toBeCloseTo(5, 6);
    expect(w.getPosition().y).toBeCloseTo(7, 6);
  });

  it("child world position is offset by the parent position", () => {
    const { world, system } = setup();
    const parent: Entity = world.createEntity();
    const child: Entity = world.createEntity();
    world.addComponent(parent, Transform2D).position.set(10, 0);
    world.addComponent(child, Transform2D).position.set(5, 0);
    world.setParent(child, parent);

    system.update({ world, dt: 0 });

    expect(world.requireComponent(child, WorldTransform2D).getPosition().x).toBeCloseTo(15, 6);
  });

  it("child inherits parent scale", () => {
    const { world, system } = setup();
    const parent: Entity = world.createEntity();
    const child: Entity = world.createEntity();
    world.addComponent(parent, Transform2D).scale.set(2, 2);
    world.addComponent(child, Transform2D).position.set(5, 0);
    world.setParent(child, parent);

    system.update({ world, dt: 0 });

    expect(world.requireComponent(child, WorldTransform2D).getPosition().x).toBeCloseTo(10, 6);
  });

  it("a dynamic body ignores parent composition", () => {
    const { world, system } = setup();
    const parent: Entity = world.createEntity();
    const child: Entity = world.createEntity();
    world.addComponent(parent, Transform2D).position.set(10, 0);
    world.addComponent(child, Transform2D).position.set(5, 0);
    const body: RigidBody2D = world.addComponent(child, RigidBody2D);
    body.type = "dynamic";
    world.setParent(child, parent);

    system.update({ world, dt: 0 });

    expect(world.requireComponent(child, WorldTransform2D).getPosition().x).toBeCloseTo(5, 6);
  });

  it("composes down a three-level chain (parent before child)", () => {
    const { world, system } = setup();
    const gp: Entity = world.createEntity();
    const p: Entity = world.createEntity();
    const c: Entity = world.createEntity();
    world.addComponent(gp, Transform2D).position.set(1, 0);
    world.addComponent(p, Transform2D).position.set(2, 0);
    world.addComponent(c, Transform2D).position.set(3, 0);
    world.setParent(p, gp);
    world.setParent(c, p);

    system.update({ world, dt: 0 });

    expect(world.requireComponent(c, WorldTransform2D).getPosition().x).toBeCloseTo(6, 6);
  });
});
