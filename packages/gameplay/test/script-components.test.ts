import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { Entity } from "@atlasjs/nexus";

import { RigidBody2D, Transform2D } from "../src/components";
import { ScriptComponentRegistry } from "../src/scripting";
import { createHarness, Harness } from "./helpers/harness";

describe("Gameplay — script components (façade over the real ECS)", () => {
  let h: Harness;
  let registry: ScriptComponentRegistry;

  beforeEach(async () => {
    h = await createHarness();
    registry = new ScriptComponentRegistry(h.world);
  });

  afterEach(() => {
    registry.dispose();
    h.physics.clear();
  });

  // --- Single source of truth: the handle points at the real component ---

  it("writes through to the real Transform2D component", () => {
    const e: Entity = h.world.createEntity();
    h.world.addComponent(e, Transform2D);

    registry.for(e).transform.setPosition(3, 4).setScale(2, 2);

    const real: Transform2D = h.world.requireComponent(e, Transform2D);
    expect(real.position.x).toBe(3);
    expect(real.position.y).toBe(4);
    expect(real.scale.x).toBe(2);
  });

  it("reads back a direct mutation of the real component (no copy)", () => {
    const e: Entity = h.world.createEntity();
    h.world.addComponent(e, Transform2D);

    const transform = registry.for(e).transform;
    h.world.requireComponent(e, Transform2D).position.set(7, 8);

    expect(transform.position.x).toBe(7);
    expect(transform.position.y).toBe(8);
  });

  it("returns a stable handle per entity", () => {
    const e: Entity = h.world.createEntity();
    h.world.addComponent(e, Transform2D);

    expect(registry.for(e)).toBe(registry.for(e));
  });

  // --- Cache invalidated by lifecycle events ---

  it("invalidates the cached instance when the component is removed and re-added", () => {
    const e: Entity = h.world.createEntity();
    const first: Transform2D = h.world.addComponent(e, Transform2D);
    first.position.set(1, 1);

    const transform = registry.for(e).transform;
    expect(transform.position.x).toBe(1); // caches `first`

    h.world.removeComponent(e, Transform2D); // onRemove -> registry invalidates
    const second: Transform2D = h.world.addComponent(e, Transform2D);
    second.position.set(9, 9);

    expect(first).not.toBe(second);
    expect(transform.position.x).toBe(9); // re-resolved to `second`, not stale `first`
  });

  it("invalidates the RigidBody2D handle cache too", () => {
    const e: Entity = h.world.createEntity();
    h.world.addComponent(e, RigidBody2D).mass = 5;

    const rigidbody = registry.for(e).rigidbody;
    expect(rigidbody.mass).toBe(5);

    h.world.removeComponent(e, RigidBody2D);
    h.world.addComponent(e, RigidBody2D).mass = 42;

    expect(rigidbody.mass).toBe(42);
  });

  // --- Authority routing decided at write time by body type ---

  it("kinematic: setPosition writes the transform and survives the frame", () => {
    const e: Entity = h.world.createEntity();
    h.world.addComponent(e, Transform2D);
    h.world.addComponent(e, RigidBody2D).type = "kinematic";

    h.frame(); // body created

    registry.for(e).transform.setPosition(5, 0);
    h.frame();

    expect(h.world.requireComponent(e, Transform2D).position.x).toBeCloseTo(
      5,
      5,
    );
  });

  it("dynamic: setPosition teleports the runtime body (survives writeback)", () => {
    const e: Entity = h.world.createEntity();
    h.world.addComponent(e, Transform2D);
    h.world.addComponent(e, RigidBody2D).type = "dynamic";

    h.frame(); // body created at (0,0)

    registry.for(e).transform.setPosition(50, 0);
    h.frame(); // dynamic: physics owns position; only a teleport survives

    expect(h.world.requireComponent(e, Transform2D).position.x).toBeCloseTo(
      50,
      5,
    );
  });

  it("dynamic: a direct position mutation is clobbered by writeback (needs a teleport)", () => {
    const e: Entity = h.world.createEntity();
    h.world.addComponent(e, Transform2D);
    h.world.addComponent(e, RigidBody2D).type = "dynamic";

    h.frame();

    // Bypasses the authority-routed setter: writes the live Vec2 directly.
    registry.for(e).transform.position.x = 50;
    h.frame();

    expect(h.world.requireComponent(e, Transform2D).position.x).toBeCloseTo(
      0,
      5,
    );
  });

  // --- RigidBody2D handle proxies the real component ---

  it("RigidBody2DComponent writes through to the real component", () => {
    const e: Entity = h.world.createEntity();
    h.world.addComponent(e, RigidBody2D);

    const rigidbody = registry.for(e).rigidbody;
    rigidbody.type = "kinematic";
    rigidbody.setVelocity(3, 4);

    const real: RigidBody2D = h.world.requireComponent(e, RigidBody2D);
    expect(real.type).toBe("kinematic");
    expect(real.velocity.x).toBe(3);
    expect(real.velocity.y).toBe(4);
  });
});
