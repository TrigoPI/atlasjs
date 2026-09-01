import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { RigidBody, RigidBodyDesc } from "@atlasjs/inertia";

import { Entity } from "@atlasjs/nexus";

import { PhysicsBodyRef, RigidBody2D, Transform2D } from "../src/components";

import { createHarness, Harness } from "./helpers/harness";
import { FakeRigidBody } from "./helpers/fake-physics";

function recordLockFlags(h: Harness): Array<boolean | undefined> {
  const recorded: Array<boolean | undefined> = [];
  const create: (descriptor: RigidBodyDesc) => RigidBody =
    h.physics.createRigidBody.bind(h.physics);

  h.physics.createRigidBody = (descriptor: RigidBodyDesc): RigidBody => {
    recorded.push(descriptor.lockRotation);
    return create(descriptor);
  };

  return recorded;
}

function bodyOf(h: Harness, entity: Entity): FakeRigidBody {
  return h.world.requireComponent(entity, PhysicsBodyRef).body as FakeRigidBody;
}

describe("Gameplay — RigidBody2D.lockRotation", () => {
  let h: Harness;

  beforeEach(async () => {
    h = await createHarness();
  });

  afterEach(() => {
    h.physics.clear();
  });

  it("defaults to false and creates an unlocked body", () => {
    const e: Entity = h.world.createEntity();
    h.world.addComponent(e, Transform2D);
    const rigidBody: RigidBody2D = h.world.addComponent(e, RigidBody2D);

    expect(rigidBody.lockRotation).toBe(false);

    const recorded: Array<boolean | undefined> = recordLockFlags(h);
    h.frame();

    expect(recorded).toEqual([false]);
    expect(bodyOf(h, e).isRotationLocked()).toBe(false);
  });

  it("passes the flag into the created body", () => {
    const e: Entity = h.world.createEntity();
    h.world.addComponent(e, Transform2D);
    h.world.addComponent(e, RigidBody2D).lockRotation = true;

    const recorded: Array<boolean | undefined> = recordLockFlags(h);
    h.frame();

    expect(recorded).toEqual([true]);
    expect(bodyOf(h, e).isRotationLocked()).toBe(true);
  });

  it("does not issue a lock call when the body was created locked", () => {
    const e: Entity = h.world.createEntity();
    h.world.addComponent(e, Transform2D);
    h.world.addComponent(e, RigidBody2D).lockRotation = true;

    h.frame();
    h.frame();
    h.frame();

    const body: FakeRigidBody = bodyOf(h, e);

    expect(body.isRotationLocked()).toBe(true);
    expect(body.setRotationLockedCount).toBe(0);
  });

  it("reaches the body when the flag changes at runtime", () => {
    const e: Entity = h.world.createEntity();
    h.world.addComponent(e, Transform2D);
    const rigidBody: RigidBody2D = h.world.addComponent(e, RigidBody2D);

    h.frame();

    const body: FakeRigidBody = bodyOf(h, e);
    expect(body.isRotationLocked()).toBe(false);
    expect(body.setRotationLockedCount).toBe(0);

    rigidBody.lockRotation = true;
    h.frame();

    expect(body.isRotationLocked()).toBe(true);
    expect(body.setRotationLockedCount).toBe(1);
  });

  it("syncs the flag once per change and never re-issues it", () => {
    const e: Entity = h.world.createEntity();
    h.world.addComponent(e, Transform2D);
    const rigidBody: RigidBody2D = h.world.addComponent(e, RigidBody2D);

    h.frame();

    const body: FakeRigidBody = bodyOf(h, e);

    rigidBody.lockRotation = true;
    h.frame();
    expect(body.setRotationLockedCount).toBe(1);

    h.frame();
    h.frame();
    h.frame();

    expect(body.setRotationLockedCount).toBe(1);
    expect(body.isRotationLocked()).toBe(true);
  });

  it("releases the lock when the flag goes back to false", () => {
    const e: Entity = h.world.createEntity();
    h.world.addComponent(e, Transform2D);
    const rigidBody: RigidBody2D = h.world.addComponent(e, RigidBody2D);
    rigidBody.lockRotation = true;

    h.frame();

    const body: FakeRigidBody = bodyOf(h, e);
    expect(body.setRotationLockedCount).toBe(0);

    rigidBody.lockRotation = false;
    h.frame();

    expect(body.isRotationLocked()).toBe(false);
    expect(body.setRotationLockedCount).toBe(1);

    h.frame();
    h.frame();

    expect(body.setRotationLockedCount).toBe(1);
  });

  it("keeps the same body instance across a lock change", () => {
    const e: Entity = h.world.createEntity();
    h.world.addComponent(e, Transform2D);
    const rigidBody: RigidBody2D = h.world.addComponent(e, RigidBody2D);

    h.frame();
    const before: RigidBody = h.world.requireComponent(e, PhysicsBodyRef).body;

    rigidBody.lockRotation = true;
    h.frame();

    expect(h.world.requireComponent(e, PhysicsBodyRef).body).toBe(before);
    expect(h.physics.createdBodyCount).toBe(1);
    expect(h.physics.bodyCount).toBe(1);
  });
  it("never writes the angular velocity while locked", () => {
    const e: Entity = h.world.createEntity();
    h.world.addComponent(e, Transform2D);
    const rigidBody: RigidBody2D = h.world.addComponent(e, RigidBody2D);
    rigidBody.lockRotation = true;
    rigidBody.angularVelocity = 5;

    h.frame();

    const body: FakeRigidBody = bodyOf(h, e);

    expect(body.setAngularVelocityCount).toBe(0);
    expect(body.getAngularVelocity()).toBe(0);

    for (let i: number = 0; i < 4; i++) {
      rigidBody.angularVelocity = 5;
      h.frame();
    }

    expect(body.setAngularVelocityCount).toBe(0);
    expect(body.getAngularVelocity()).toBe(0);
    expect(body.getRotation()).toBe(0);
  });

  it("settles the component at zero while locked, with no help from the pull system", () => {
    const e: Entity = h.world.createEntity();
    h.world.addComponent(e, Transform2D);
    const rigidBody: RigidBody2D = h.world.addComponent(e, RigidBody2D);
    rigidBody.lockRotation = true;
    rigidBody.angularVelocity = 5;

    h.frame();

    expect(rigidBody.angularVelocity).toBe(0);
    expect(bodyOf(h, e).setAngularVelocityCount).toBe(0);
  });

  it("resumes the angular-velocity write once the lock is cleared", () => {
    const e: Entity = h.world.createEntity();
    h.world.addComponent(e, Transform2D);
    const rigidBody: RigidBody2D = h.world.addComponent(e, RigidBody2D);
    rigidBody.lockRotation = true;
    rigidBody.angularVelocity = 5;

    h.frame();

    const body: FakeRigidBody = bodyOf(h, e);
    expect(body.setAngularVelocityCount).toBe(0);

    rigidBody.lockRotation = false;
    rigidBody.angularVelocity = 5;
    h.frame();

    expect(body.setAngularVelocityCount).toBeGreaterThan(0);
    expect(body.getAngularVelocity()).toBeCloseTo(5, 10);
  });

  it("keeps writing the angular velocity on an unlocked body", () => {
    const e: Entity = h.world.createEntity();
    h.world.addComponent(e, Transform2D);
    const rigidBody: RigidBody2D = h.world.addComponent(e, RigidBody2D);
    rigidBody.angularVelocity = 3;

    h.frame();

    const body: FakeRigidBody = bodyOf(h, e);
    const afterFirst: number = body.setAngularVelocityCount;

    expect(rigidBody.lockRotation).toBe(false);
    expect(afterFirst).toBeGreaterThan(0);

    h.frame();
    h.frame();

    expect(body.setAngularVelocityCount).toBeGreaterThan(afterFirst);
  });
});
