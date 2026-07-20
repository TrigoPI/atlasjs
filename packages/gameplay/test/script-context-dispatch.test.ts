import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { Entity } from "@atlasjs/nexus";

import { RigidBody2D, Transform2D } from "../src/components";
import { AtlasScript, RigidBody, Transform } from "../src/scripting";
import { createHarness, Harness } from "./helpers/harness";

class Health {
  public hp: number;

  public constructor(hp: number = 100) {
    this.hp = hp;
  }
}

// Façade branch (Transform) + raw branch (RigidBody alias + Health data).
class DispatchProbe extends AtlasScript {
  public transform!: Transform;
  public health!: Health;
  public hadTransformBefore: boolean = true;
  public transformBefore: Transform | undefined;
  public hadTransformEngine: boolean = false;
  public rigidbodyRaw: RigidBody2D | undefined;

  public onCreate(): void {
    this.hadTransformBefore = this.hasComponent(Transform);
    this.transformBefore = this.getComponent(Transform);

    this.transform = this.addComponent(Transform);
    this.transform.setPosition(11, 22);
    this.hadTransformEngine = this.hasComponent(Transform);

    this.health = this.addComponent(Health, 50);
    this.rigidbodyRaw = this.getComponent(RigidBody);
  }
}

describe("Gameplay — script context dispatch (façade vs raw)", () => {
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

  it("hasComponent/getComponent(façade) reflect the backing engine component", () => {
    const e: Entity = h.world.createEntity();
    const probe: DispatchProbe = h.scripts.attach(e, DispatchProbe);

    h.frame();

    expect(probe.hadTransformBefore).toBe(false);
    expect(probe.transformBefore).toBeUndefined();
    expect(probe.hadTransformEngine).toBe(true);
  });

  it("addComponent(dataComponent, ...args) forwards args and returns the raw instance", () => {
    const e: Entity = h.world.createEntity();
    const probe: DispatchProbe = h.scripts.attach(e, DispatchProbe);

    h.frame();

    expect(probe.health).toBeInstanceOf(Health);
    expect(probe.health.hp).toBe(50);
    expect(h.world.requireComponent(e, Health)).toBe(probe.health);
  });

  it("getComponent(rawAlias) uses the raw branch and returns undefined when absent", () => {
    const e: Entity = h.world.createEntity();
    const probe: DispatchProbe = h.scripts.attach(e, DispatchProbe);

    h.frame();

    expect(probe.rigidbodyRaw).toBeUndefined();
  });

  it("removeComponent(façade) removes the backing engine component", () => {
    const e: Entity = h.world.createEntity();
    const probe: DispatchProbe = h.scripts.attach(e, DispatchProbe);

    h.frame();

    expect(h.world.hasComponent(e, Transform2D)).toBe(true);
    probe.removeComponent(Transform);
    expect(h.world.hasComponent(e, Transform2D)).toBe(false);
  });

  it("requireComponent(façade) throws when the engine component is missing", () => {
    const e: Entity = h.world.createEntity();
    const bare: AtlasScript = h.scripts.attach(e, class extends AtlasScript {});

    h.frame();

    expect(() => bare.requireComponent(Transform)).toThrow();
  });
});
