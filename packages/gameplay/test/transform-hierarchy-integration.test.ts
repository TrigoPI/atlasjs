import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { Entity } from "@atlasjs/nexus";

import { RigidBody2D, Transform2D, WorldTransform2D } from "../src/components";
import { createHarness, Harness } from "./helpers/harness";

describe("Gameplay — transform hierarchy integration", () => {
  let h: Harness;

  beforeEach(async () => {
    h = await createHarness();
  });

  afterEach(() => {
    h.physics.clear();
  });

  it("a parented child composes its world transform through the scheduler", () => {
    const parent: Entity = h.world.createEntity();
    const child: Entity = h.world.createEntity();
    h.world.addComponent(parent, Transform2D).position.set(100, 0);
    h.world.addComponent(child, Transform2D).position.set(20, 0);
    h.world.setParent(child, parent);

    h.frame();

    const w: WorldTransform2D = h.world.requireComponent(child, WorldTransform2D);
    expect(w.getPosition().x).toBeCloseTo(120, 4);
  });

  it("a kinematic child's local transform is not corrupted by physics writeback", () => {
    const parent: Entity = h.world.createEntity();
    const child: Entity = h.world.createEntity();
    h.world.addComponent(parent, Transform2D).position.set(100, 0);

    h.world.addComponent(child, Transform2D).position.set(20, 0);
    const body: RigidBody2D = h.world.addComponent(child, RigidBody2D);
    body.type = "kinematic";
    h.world.setParent(child, parent);

    h.frame();
    h.frame();

    const local: Transform2D = h.world.requireComponent(child, Transform2D);
    expect(local.position.x).toBeCloseTo(20, 4);
  });
});
