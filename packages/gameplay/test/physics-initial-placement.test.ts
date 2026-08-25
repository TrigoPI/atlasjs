import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { RigidBody, RigidBodyDesc } from "@atlasjs/inertia";
import { Entity } from "@atlasjs/nexus";

import { RigidBody2D, Transform2D, WorldTransform2D } from "../src/components";
import { createHarness, Harness } from "./helpers/harness";

type CreationPlacement = {
  x: number;
  y: number;
  rotation: number;
};

function recordBodyCreations(h: Harness): CreationPlacement[] {
  const recorded: CreationPlacement[] = [];
  const create: (descriptor: RigidBodyDesc) => RigidBody =
    h.physics.createRigidBody.bind(h.physics);

  h.physics.createRigidBody = (descriptor: RigidBodyDesc): RigidBody => {
    recorded.push({
      x: descriptor.translation?.x ?? 0,
      y: descriptor.translation?.y ?? 0,
      rotation: descriptor.rotation ?? 0,
    });

    return create(descriptor);
  };

  return recorded;
}

describe("Gameplay — physics initial placement", () => {
  let h: Harness;

  beforeEach(async () => {
    h = await createHarness();
  });

  afterEach(() => {
    h.physics.clear();
  });

  it("dynamic child: body is created at its local transform even when WorldTransform2D is already populated", () => {
    const parent: Entity = h.world.createEntity();
    const child: Entity = h.world.createEntity();

    const parentTransform: Transform2D = h.world.addComponent(
      parent,
      Transform2D,
    );
    parentTransform.position.set(100, 40);
    parentTransform.rotation = 0;

    const childTransform: Transform2D = h.world.addComponent(
      child,
      Transform2D,
    );
    childTransform.position.set(20, 5);
    childTransform.rotation = 0.25;

    h.world.setParent(child, parent);

    h.frame();

    const worldTransform: WorldTransform2D = h.world.requireComponent(
      child,
      WorldTransform2D,
    );
    expect(worldTransform.getPosition().x).toBeCloseTo(120, 4);

    const recorded: CreationPlacement[] = recordBodyCreations(h);

    const rigidBody: RigidBody2D = h.world.addComponent(child, RigidBody2D);
    rigidBody.type = "dynamic";

    h.frame();

    expect(recorded).toHaveLength(1);
    expect(recorded[0].x).toBeCloseTo(20, 4);
    expect(recorded[0].y).toBeCloseTo(5, 4);
    expect(recorded[0].rotation).toBeCloseTo(0.25, 4);

    const local: Transform2D = h.world.requireComponent(child, Transform2D);
    expect(local.position.x).toBeCloseTo(20, 4);
    expect(local.position.y).toBeCloseTo(5, 4);
  });

  it("kinematic child: body is still created at its composed world transform", () => {
    const parent: Entity = h.world.createEntity();
    const child: Entity = h.world.createEntity();

    h.world.addComponent(parent, Transform2D).position.set(100, 40);
    h.world.addComponent(child, Transform2D).position.set(20, 5);
    h.world.setParent(child, parent);

    h.frame();

    const recorded: CreationPlacement[] = recordBodyCreations(h);

    const rigidBody: RigidBody2D = h.world.addComponent(child, RigidBody2D);
    rigidBody.type = "kinematic";

    h.frame();

    expect(recorded).toHaveLength(1);
    expect(recorded[0].x).toBeCloseTo(120, 4);
    expect(recorded[0].y).toBeCloseTo(45, 4);
  });

  it("static child: body is still created at its composed world transform", () => {
    const parent: Entity = h.world.createEntity();
    const child: Entity = h.world.createEntity();

    h.world.addComponent(parent, Transform2D).position.set(100, 40);
    h.world.addComponent(child, Transform2D).position.set(20, 5);
    h.world.setParent(child, parent);

    h.frame();

    const recorded: CreationPlacement[] = recordBodyCreations(h);

    const rigidBody: RigidBody2D = h.world.addComponent(child, RigidBody2D);
    rigidBody.type = "static";

    h.frame();

    expect(recorded).toHaveLength(1);
    expect(recorded[0].x).toBeCloseTo(120, 4);
    expect(recorded[0].y).toBeCloseTo(45, 4);
  });

  it("unparented dynamic: body is created at its transform, unchanged", () => {
    const entity: Entity = h.world.createEntity();
    const transform: Transform2D = h.world.addComponent(entity, Transform2D);
    transform.position.set(7, -3);
    transform.rotation = 1.5;

    h.frame();

    const recorded: CreationPlacement[] = recordBodyCreations(h);

    const rigidBody: RigidBody2D = h.world.addComponent(entity, RigidBody2D);
    rigidBody.type = "dynamic";

    h.frame();

    expect(recorded).toHaveLength(1);
    expect(recorded[0].x).toBeCloseTo(7, 4);
    expect(recorded[0].y).toBeCloseTo(-3, 4);
    expect(recorded[0].rotation).toBeCloseTo(1.5, 4);
  });
});
