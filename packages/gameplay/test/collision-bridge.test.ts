import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { ColliderShapeDesc } from "@atlasjs/inertia";
import { Entity } from "@atlasjs/nexus";

import { Collider2D, RigidBody2D, Transform2D } from "../src/components";
import { createHarness, Harness } from "./helpers/harness";

const BOX: ColliderShapeDesc = { type: "box", width: 10, height: 10 };

describe("Gameplay — collision bridge", () => {
  let h: Harness;

  beforeEach(async () => {
    h = await createHarness();
  });

  afterEach(() => {
    h.physics.clear();
  });

  it("creates exactly one collider per Collider2D entity", () => {
    const e: Entity = h.world.createEntity();
    h.world.addComponent(e, Transform2D);
    h.world.addComponent(e, Collider2D, BOX);

    h.frame();
    expect(h.physics.colliderCount).toBe(1);

    h.frame();
    expect(h.physics.colliderCount).toBe(1);
  });

  it("tags the collider userData with the owning entity", () => {
    const e: Entity = h.world.createEntity();
    h.world.addComponent(e, Transform2D);
    h.world.addComponent(e, Collider2D, BOX);

    h.frame();
    const collider = [...h.physics.colliders][0];
    expect(collider.getUserData<Entity>()).toBe(e);
  });

  it("attaches the collider to the body when RigidBody2D is present", () => {
    const e: Entity = h.world.createEntity();
    h.world.addComponent(e, Transform2D);
    h.world.addComponent(e, RigidBody2D);
    h.world.addComponent(e, Collider2D, BOX);

    h.frame();
    const collider = [...h.physics.colliders][0];
    expect(collider.getRigidBody()).not.toBeNull();
  });

  it("destroys the collider when Collider2D is removed", () => {
    const e: Entity = h.world.createEntity();
    h.world.addComponent(e, Transform2D);
    h.world.addComponent(e, Collider2D, BOX);

    h.frame();
    expect(h.physics.colliderCount).toBe(1);

    h.world.removeComponent(e, Collider2D);
    expect(h.physics.colliderCount).toBe(0);
  });

  it("destroys the collider when the entity is destroyed", () => {
    const e: Entity = h.world.createEntity();
    h.world.addComponent(e, Transform2D);
    h.world.addComponent(e, Collider2D, BOX);

    h.frame();
    expect(h.physics.colliderCount).toBe(1);

    h.world.destroyEntity(e);
    expect(h.physics.colliderCount).toBe(0);
  });
});
