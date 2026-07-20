import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { Entity } from "@atlasjs/nexus";

import { RigidBody2D, Transform2D } from "../src/components";
import {
  AtlasScript,
  RigidBody2DComponent,
  Transform,
} from "../src/scripting";
import { createHarness, Harness } from "./helpers/harness";

class Health {
  public hp: number;

  public constructor(hp: number = 100) {
    this.hp = hp;
  }
}

// Exercises the context dispatch: façade types resolve to the backing engine
// component + return a proxy; plain data types go straight through as raw.
class DispatchProbe extends AtlasScript {
  public transform!: Transform;
  public rigidbody: RigidBody2DComponent | undefined;
  public health!: Health;
  public hadTransformEngine: boolean = false;
  public hadRigidbodyBefore: boolean = true;

  public onCreate(): void {
    this.transform = this.addComponent(Transform);
    this.transform.setPosition(11, 22);

    this.health = this.addComponent(Health, 50);

    this.hadTransformEngine = this.hasComponent(Transform);
    this.hadRigidbodyBefore = this.hasComponent(RigidBody2DComponent);
    this.rigidbody = this.getComponent(RigidBody2DComponent);
  }
}

describe("Gameplay — script context dispatch (façade vs raw data)", () => {
  let h: Harness;

  beforeEach(async () => {
    h = await createHarness();
  });

  afterEach(() => {
    h.physics.clear();
  });

  it("addComponent(façade) adds the backing engine component and proxies it", () => {
    const e: Entity = h.world.createEntity();
    const probe: DispatchProbe = h.scripts.attach(e, DispatchProbe);

    h.frame();

    expect(h.world.hasComponent(e, Transform2D)).toBe(true);
    const real: Transform2D = h.world.requireComponent(e, Transform2D);
    expect(real.position.x).toBe(11);
    expect(real.position.y).toBe(22);
    expect(probe.transform).toBeInstanceOf(Transform);
  });

  it("addComponent(dataComponent, ...args) forwards args and returns the raw instance", () => {
    const e: Entity = h.world.createEntity();
    const probe: DispatchProbe = h.scripts.attach(e, DispatchProbe);

    h.frame();

    expect(probe.health).toBeInstanceOf(Health);
    expect(probe.health.hp).toBe(50);
    expect(h.world.requireComponent(e, Health)).toBe(probe.health);
  });

  it("hasComponent(façade) tests the backing engine component", () => {
    const e: Entity = h.world.createEntity();
    const probe: DispatchProbe = h.scripts.attach(e, DispatchProbe);

    h.frame();

    expect(probe.hadTransformEngine).toBe(true);
    expect(probe.hadRigidbodyBefore).toBe(false);
  });

  it("getComponent(façade) returns undefined when the engine component is absent", () => {
    const e: Entity = h.world.createEntity();
    const probe: DispatchProbe = h.scripts.attach(e, DispatchProbe);

    h.frame();

    expect(probe.rigidbody).toBeUndefined();
  });

  it("removeComponent(façade) removes the backing engine component", () => {
    const e: Entity = h.world.createEntity();
    h.world.addComponent(e, RigidBody2D);
    const probe: DispatchProbe = h.scripts.attach(e, DispatchProbe);

    h.frame();

    expect(probe.rigidbody).toBeInstanceOf(RigidBody2DComponent);

    probe.removeComponent(RigidBody2DComponent);
    expect(h.world.hasComponent(e, RigidBody2D)).toBe(false);
  });

  it("requireComponent(façade) throws when the engine component is missing", () => {
    const e: Entity = h.world.createEntity();
    const probe: DispatchProbe = h.scripts.attach(e, DispatchProbe);

    h.frame();

    expect(() => probe.requireComponent(RigidBody2DComponent)).toThrow();
  });
});
