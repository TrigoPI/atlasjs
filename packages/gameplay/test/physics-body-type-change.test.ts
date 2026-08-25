import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  Collider,
  ColliderShapeDesc,
  RigidBody,
  RigidBodyDesc,
  RigidBodyType,
} from "@atlasjs/inertia";

import { Entity } from "@atlasjs/nexus";

import {
  CharacterController2D,
  CharacterControllerRef,
  Collider2D,
  PhysicsBodyRef,
  PhysicsColliderRef,
  RigidBody2D,
  Transform2D,
} from "../src/components";

import { createHarness, Harness } from "./helpers/harness";

const BOX: ColliderShapeDesc = { type: "box", width: 10, height: 10 };

type CreationRecord = {
  type: RigidBodyType;
  x: number;
  y: number;
  rotation: number;
  velocityX: number;
  velocityY: number;
  angularVelocity: number;
};

function recordBodyCreations(h: Harness): CreationRecord[] {
  const recorded: CreationRecord[] = [];
  const create: (descriptor: RigidBodyDesc) => RigidBody =
    h.physics.createRigidBody.bind(h.physics);

  h.physics.createRigidBody = (descriptor: RigidBodyDesc): RigidBody => {
    recorded.push({
      type: descriptor.type ?? "dynamic",
      x: descriptor.translation?.x ?? 0,
      y: descriptor.translation?.y ?? 0,
      rotation: descriptor.rotation ?? 0,
      velocityX: descriptor.linearVelocity?.x ?? 0,
      velocityY: descriptor.linearVelocity?.y ?? 0,
      angularVelocity: descriptor.angularVelocity ?? 0,
    });

    return create(descriptor);
  };

  return recorded;
}

describe("Gameplay — RigidBody2D.type change after creation", () => {
  let h: Harness;

  beforeEach(async () => {
    h = await createHarness();
  });

  afterEach(() => {
    h.physics.clear();
  });

  it("dynamic -> kinematic: the runtime body adopts the new type", () => {
    const e: Entity = h.world.createEntity();
    h.world.addComponent(e, Transform2D);
    const rigidBody: RigidBody2D = h.world.addComponent(e, RigidBody2D);
    rigidBody.type = "dynamic";

    h.frame();
    expect(h.world.requireComponent(e, PhysicsBodyRef).body.type).toBe(
      "dynamic",
    );

    rigidBody.type = "kinematic";
    h.frame();

    expect(h.world.hasComponent(e, PhysicsBodyRef)).toBe(true);
    expect(h.world.requireComponent(e, PhysicsBodyRef).body.type).toBe(
      "kinematic",
    );
    expect(h.physics.bodyCount).toBe(1);
  });

  it("kinematic -> dynamic: the runtime body adopts the new type", () => {
    const e: Entity = h.world.createEntity();
    h.world.addComponent(e, Transform2D);
    const rigidBody: RigidBody2D = h.world.addComponent(e, RigidBody2D);
    rigidBody.type = "kinematic";

    h.frame();
    expect(h.world.requireComponent(e, PhysicsBodyRef).body.type).toBe(
      "kinematic",
    );

    rigidBody.type = "dynamic";
    h.frame();

    expect(h.world.hasComponent(e, PhysicsBodyRef)).toBe(true);
    expect(h.world.requireComponent(e, PhysicsBodyRef).body.type).toBe(
      "dynamic",
    );
    expect(h.physics.bodyCount).toBe(1);
  });

  it("the stale body is destroyed, not leaked, when the type changes", () => {
    const e: Entity = h.world.createEntity();
    h.world.addComponent(e, Transform2D);
    const rigidBody: RigidBody2D = h.world.addComponent(e, RigidBody2D);

    h.frame();
    const stale: RigidBody = h.world.requireComponent(e, PhysicsBodyRef).body;

    rigidBody.type = "static";
    h.frame();

    const rebuilt: RigidBody = h.world.requireComponent(e, PhysicsBodyRef).body;

    expect(rebuilt).not.toBe(stale);
    expect(h.physics.bodyCount).toBe(1);
    expect([...h.physics.bodies][0]).toBe(rebuilt);
  });

  it("preserves the velocity across the transition", () => {
    const e: Entity = h.world.createEntity();
    h.world.addComponent(e, Transform2D);
    const rigidBody: RigidBody2D = h.world.addComponent(e, RigidBody2D);
    rigidBody.type = "dynamic";
    rigidBody.velocity.set(5, -2);
    rigidBody.angularVelocity = 1.5;

    h.frame();

    const recorded: CreationRecord[] = recordBodyCreations(h);

    rigidBody.type = "kinematic";
    h.frame();

    expect(recorded).toHaveLength(1);
    expect(recorded[0].type).toBe("kinematic");
    expect(recorded[0].velocityX).toBeCloseTo(5, 5);
    expect(recorded[0].velocityY).toBeCloseTo(-2, 5);
    expect(recorded[0].angularVelocity).toBeCloseTo(1.5, 5);

    const body: RigidBody = h.world.requireComponent(e, PhysicsBodyRef).body;
    expect(body.getLinearVelocity().x).toBeCloseTo(5, 5);
    expect(body.getLinearVelocity().y).toBeCloseTo(-2, 5);
    expect(body.getAngularVelocity()).toBeCloseTo(1.5, 5);
  });

  it("preserves the position across the transition", () => {
    const e: Entity = h.world.createEntity();
    const transform: Transform2D = h.world.addComponent(e, Transform2D);
    transform.position.set(12, -4);
    transform.rotation = 0.75;

    const rigidBody: RigidBody2D = h.world.addComponent(e, RigidBody2D);
    rigidBody.type = "kinematic";

    h.frame();

    const recorded: CreationRecord[] = recordBodyCreations(h);

    rigidBody.type = "dynamic";
    h.frame();

    expect(recorded).toHaveLength(1);
    expect(recorded[0].x).toBeCloseTo(12, 5);
    expect(recorded[0].y).toBeCloseTo(-4, 5);
    expect(recorded[0].rotation).toBeCloseTo(0.75, 5);

    const body: RigidBody = h.world.requireComponent(e, PhysicsBodyRef).body;
    expect(body.getTranslation().x).toBeCloseTo(12, 5);
    expect(body.getTranslation().y).toBeCloseTo(-4, 5);

    const after: Transform2D = h.world.requireComponent(e, Transform2D);
    expect(after.position.x).toBeCloseTo(12, 5);
    expect(after.position.y).toBeCloseTo(-4, 5);
  });

  it("rebuilds the collider and reattaches it to the new body", () => {
    const e: Entity = h.world.createEntity();
    h.world.addComponent(e, Transform2D);
    const rigidBody: RigidBody2D = h.world.addComponent(e, RigidBody2D);
    h.world.addComponent(e, Collider2D, BOX);

    h.frame();

    const staleCollider: Collider = h.world.requireComponent(
      e,
      PhysicsColliderRef,
    ).collider;

    rigidBody.type = "kinematic";
    h.frame();

    const rebuiltCollider: Collider = h.world.requireComponent(
      e,
      PhysicsColliderRef,
    ).collider;

    const rebuiltBody: RigidBody = h.world.requireComponent(
      e,
      PhysicsBodyRef,
    ).body;

    expect(rebuiltCollider).not.toBe(staleCollider);
    expect(rebuiltCollider.getRigidBody()).toBe(rebuiltBody);
    expect(h.physics.colliderCount).toBe(1);
    expect([...h.physics.colliders][0]).toBe(rebuiltCollider);
  });

  it("keeps the character controller across the transition", () => {
    const e: Entity = h.world.createEntity();
    h.world.addComponent(e, Transform2D);
    const rigidBody: RigidBody2D = h.world.addComponent(e, RigidBody2D);
    rigidBody.type = "kinematic";
    h.world.addComponent(e, Collider2D, BOX);
    h.world.addComponent(e, CharacterController2D);

    h.frame();

    const controller: CharacterControllerRef = h.world.requireComponent(
      e,
      CharacterControllerRef,
    );

    rigidBody.type = "dynamic";
    h.frame();

    expect(h.world.requireComponent(e, CharacterControllerRef)).toBe(
      controller,
    );

    expect(h.physics.characterControllerCount).toBe(1);
  });

  it("does not recreate anything while the type is stable", () => {
    const dynamicEntity: Entity = h.world.createEntity();
    h.world.addComponent(dynamicEntity, Transform2D);
    h.world.addComponent(dynamicEntity, RigidBody2D).type = "dynamic";
    h.world.addComponent(dynamicEntity, Collider2D, BOX);

    const kinematicEntity: Entity = h.world.createEntity();
    h.world.addComponent(kinematicEntity, Transform2D);
    h.world.addComponent(kinematicEntity, RigidBody2D).type = "kinematic";
    h.world.addComponent(kinematicEntity, Collider2D, BOX);

    const staticEntity: Entity = h.world.createEntity();
    h.world.addComponent(staticEntity, Transform2D);
    h.world.addComponent(staticEntity, RigidBody2D).type = "static";
    h.world.addComponent(staticEntity, Collider2D, BOX);

    h.frame();
    h.frame();
    h.frame();
    h.frame();
    h.frame();

    expect(h.physics.createdBodyCount).toBe(3);
    expect(h.physics.createdColliderCount).toBe(3);
    expect(h.physics.bodyCount).toBe(3);
    expect(h.physics.colliderCount).toBe(3);
  });

  it("recreates exactly once per type change, not once per frame", () => {
    const e: Entity = h.world.createEntity();
    h.world.addComponent(e, Transform2D);
    const rigidBody: RigidBody2D = h.world.addComponent(e, RigidBody2D);
    h.world.addComponent(e, Collider2D, BOX);

    h.frame();
    expect(h.physics.createdBodyCount).toBe(1);
    expect(h.physics.createdColliderCount).toBe(1);

    rigidBody.type = "kinematic";
    h.frame();
    expect(h.physics.createdBodyCount).toBe(2);
    expect(h.physics.createdColliderCount).toBe(2);

    h.frame();
    h.frame();
    h.frame();

    expect(h.physics.createdBodyCount).toBe(2);
    expect(h.physics.createdColliderCount).toBe(2);
    expect(h.physics.bodyCount).toBe(1);
    expect(h.physics.colliderCount).toBe(1);
  });
});
