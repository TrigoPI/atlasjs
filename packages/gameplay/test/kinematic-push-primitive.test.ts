import { beforeEach, describe, expect, it } from "vitest";

import { ColliderShapeDesc } from "@atlasjs/inertia";
import { Entity } from "@atlasjs/nexus";

import {
  CharacterController2D,
  Collider2D,
  PhysicsBodyRef,
  RigidBody2D,
  Transform2D,
} from "../src/components";

import { FakeRigidBody } from "./helpers/fake-physics";
import { createHarness, Harness } from "./helpers/harness";

const BOX: ColliderShapeDesc = { type: "box", width: 10, height: 10 };

function spawn(
  h: Harness,
  type: RigidBody2D["type"],
  controller: boolean,
): Entity {
  const e: Entity = h.world.createEntity();
  h.world.addComponent(e, Transform2D);

  const body: RigidBody2D = h.world.addComponent(e, RigidBody2D);
  body.type = type;

  h.world.addComponent(e, Collider2D, BOX);

  if (controller) {
    h.world.addComponent(e, CharacterController2D);
  }

  return e;
}

function bodyOf(h: Harness, entity: Entity): FakeRigidBody {
  return h.world.requireComponent(entity, PhysicsBodyRef).body as FakeRigidBody;
}

describe("PhysicsPushSystem kinematic push primitive", () => {
  let h: Harness;

  beforeEach(async () => {
    h = await createHarness();
  });

  it("drives a plain kinematic body through setNextKinematicTranslation", () => {
    const e: Entity = spawn(h, "kinematic", false);
    h.frame();

    const body: FakeRigidBody = bodyOf(h, e);
    const before: number = body.setNextKinematicTranslationCount;

    h.world.requireComponent(e, Transform2D).position.set(7, 3);
    h.frame();

    expect(body.setNextKinematicTranslationCount).toBeGreaterThan(before);
    expect(body.getTranslation().x).toBeCloseTo(7, 5);
    expect(body.getTranslation().y).toBeCloseTo(3, 5);
  });

  it("keeps a character-controlled kinematic body on the immediate setTranslation path", () => {
    const e: Entity = spawn(h, "kinematic", true);
    h.frame();

    const body: FakeRigidBody = bodyOf(h, e);
    const nextBefore: number = body.setNextKinematicTranslationCount;
    const directBefore: number = body.setTranslationCount;

    h.world.requireComponent(e, Transform2D).position.set(7, 3);
    h.frame();

    expect(body.setNextKinematicTranslationCount).toBe(nextBefore);
    expect(body.setTranslationCount).toBeGreaterThan(directBefore);
  });

  it("keeps a static body on the immediate setTranslation path", () => {
    const e: Entity = spawn(h, "static", false);
    h.frame();

    const body: FakeRigidBody = bodyOf(h, e);
    const nextBefore: number = body.setNextKinematicTranslationCount;
    const directBefore: number = body.setTranslationCount;

    h.world.requireComponent(e, Transform2D).position.set(7, 3);
    h.frame();

    expect(body.setNextKinematicTranslationCount).toBe(nextBefore);
    expect(body.setTranslationCount).toBeGreaterThan(directBefore);
  });
});
