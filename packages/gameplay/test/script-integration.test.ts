import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { Entity } from "@atlasjs/nexus";

import { Transform2D } from "../src/components";
import {
  AtlasScript,
  RigidBody2DComponent,
  Transform2DComponent,
} from "../src/scripting";
import { createHarness, Harness } from "./helpers/harness";

// A script that drives a kinematic body entirely through the façade —
// the sandbox's real scenario. onCreate seeds the pose, onFixedUpdate steps it.
class KinematicMover extends AtlasScript {
  private transform!: Transform2DComponent;
  private rigidbody!: RigidBody2DComponent;

  public onCreate(): void {
    this.transform = this.addComponent(Transform2DComponent);
    this.rigidbody = this.addComponent(RigidBody2DComponent);
    this.rigidbody.type = "kinematic";
    this.transform.setPosition(100, 0);
  }

  public onFixedUpdate(): void {
    this.transform.translate(10, 0);
  }
}

describe("Gameplay — script → handle → bridge → physics (end to end)", () => {
  let h: Harness;

  beforeEach(async () => {
    h = await createHarness();
  });

  afterEach(() => {
    h.physics.clear();
  });

  it("a kinematic script drives the real Transform2D and the runtime body", () => {
    const e: Entity = h.world.createEntity();
    h.scripts.attach(e, KinematicMover);

    h.frame(3); // onCreate (100) + 3 * onFixedUpdate (+10) => 130

    const transform: Transform2D = h.world.requireComponent(e, Transform2D);
    expect(transform.position.x).toBeCloseTo(130, 5);

    const body = [...h.physics.bodies][0];
    expect(body.getTranslation().x).toBeCloseTo(130, 5);
  });

  it("tears down a scripted entity cleanly (no dangling physics body)", () => {
    const e: Entity = h.world.createEntity();
    h.scripts.attach(e, KinematicMover);

    h.frame(1);
    expect(h.world.requireComponent(e, Transform2D).position.x).toBeCloseTo(
      110,
      5,
    );
    expect(h.physics.bodyCount).toBe(1);

    h.scripts.destroyAllByEntity(e);
    h.world.destroyEntity(e);

    // The body is torn down through onRemove(PhysicsBodyRef); no dangling body.
    expect(h.physics.bodyCount).toBe(0);
  });
});
