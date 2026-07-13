import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { Entity } from "@atlasjs/nexus";

import { RigidBody2D, Transform2D } from "../src/components";
import { createHarness, Harness } from "./helpers/harness";

describe("Gameplay — physics bridge authority", () => {
  let h: Harness;

  beforeEach(async () => {
    h = await createHarness();
  });

  afterEach(() => {
    h.physics.clear();
  });

  // --- Behavior we must PRESERVE across the refactor (green today) ---

  it("creates exactly one physics body per (RigidBody2D, Transform2D) entity", () => {
    const e: Entity = h.world.createEntity();
    h.world.addComponent(e, Transform2D);
    h.world.addComponent(e, RigidBody2D);

    h.frame();
    expect(h.physics.bodyCount).toBe(1);

    // Re-running frames must not spawn duplicate bodies.
    h.frame();
    h.frame();
    expect(h.physics.bodyCount).toBe(1);
  });

  it("dynamic: physics is authoritative — velocity integrates into the transform", () => {
    const e: Entity = h.world.createEntity();
    h.world.addComponent(e, Transform2D);
    const body: RigidBody2D = h.world.addComponent(e, RigidBody2D);
    body.type = "dynamic";
    body.velocity.set(10, 0);

    h.frame(1); // one fixed step at dt=0.1 => +1.0 on x

    const t: Transform2D = h.world.requireComponent(e, Transform2D);
    expect(t.position.x).toBeCloseTo(1, 5);
  });

  it("destroys the physics body when RigidBody2D is removed", () => {
    const e: Entity = h.world.createEntity();
    h.world.addComponent(e, Transform2D);
    h.world.addComponent(e, RigidBody2D);

    h.frame();
    expect(h.physics.bodyCount).toBe(1);

    h.world.removeComponent(e, RigidBody2D);
    expect(h.physics.bodyCount).toBe(0);
  });

  it("destroys the physics body when the entity is destroyed", () => {
    const e: Entity = h.world.createEntity();
    h.world.addComponent(e, Transform2D);
    h.world.addComponent(e, RigidBody2D);

    h.frame();
    expect(h.physics.bodyCount).toBe(1);

    h.world.destroyEntity(e);
    expect(h.physics.bodyCount).toBe(0);
  });

  // --- TARGET behavior, implemented in Phase 1: PhysicsPushSystem pushes
  // Transform2D -> body for kinematic/static bodies before the step. ---

  it(
    "kinematic: transform is authoritative — a direct write is NOT clobbered by writeback",
    () => {
      const e: Entity = h.world.createEntity();
      h.world.addComponent(e, Transform2D);
      const body: RigidBody2D = h.world.addComponent(e, RigidBody2D);
      body.type = "kinematic";

      h.frame(); // body created at (0,0)

      // A script/user moves the transform (the user's exact pain point:
      // "position.x += 10 must stick").
      h.world.requireComponent(e, Transform2D).position.set(5, 0);

      h.frame(); // Phase 1: push transform->body, writeback keeps it at 5

      const t: Transform2D = h.world.requireComponent(e, Transform2D);
      expect(t.position.x).toBeCloseTo(5, 5);
    },
  );

  it(
    "kinematic: the pushed transform reaches the physics body",
    () => {
      const e: Entity = h.world.createEntity();
      h.world.addComponent(e, Transform2D);
      const body: RigidBody2D = h.world.addComponent(e, RigidBody2D);
      body.type = "kinematic";

      h.frame();
      h.world.requireComponent(e, Transform2D).position.set(7, 3);
      h.frame();

      const runtime = [...h.physics.bodies][0];
      expect(runtime.getTranslation().x).toBeCloseTo(7, 5);
      expect(runtime.getTranslation().y).toBeCloseTo(3, 5);
    },
  );
});
