import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { ColliderShapeDesc } from "@atlasjs/inertia";
import { Entity } from "@atlasjs/nexus";

import {
  CharacterController2D,
  Collider2D,
  Transform2D,
} from "../src/components";
import { FakeCollider } from "./helpers/fake-physics";
import { createHarness, Harness } from "./helpers/harness";

const BOX: ColliderShapeDesc = { type: "box", width: 10, height: 10 };

describe("Gameplay — Collider2D property sync", () => {
  let h: Harness;

  beforeEach(async () => {
    h = await createHarness();
  });

  afterEach(() => {
    h.physics.clear();
  });

  function spawn(): { entity: Entity; col: Collider2D; runtime: FakeCollider } {
    const entity: Entity = h.world.createEntity();
    h.world.addComponent(entity, Transform2D);
    const col: Collider2D = h.world.addComponent(entity, Collider2D, BOX);

    h.frame();

    const runtime: FakeCollider = [...h.physics.colliders][0];
    return { entity, col, runtime };
  }

  it("pushes an isSensor flip made after the collider exists", () => {
    const { col, runtime } = spawn();
    expect(runtime.isSensor()).toBe(false);

    col.isSensor = true;
    h.frame();

    expect(runtime.isSensor()).toBe(true);

    col.isSensor = false;
    h.frame();

    expect(runtime.isSensor()).toBe(false);
  });

  it("pushes layer and collidesWith changes made after the collider exists", () => {
    const { col, runtime } = spawn();

    col.layer = 0b0010;
    col.collidesWith = 0b0100;
    h.frame();

    expect(runtime.getCollisionGroup()).toBe(0b0010);
    expect(runtime.getCollisionMask()).toBe(0b0100);
  });

  it("pushes friction, restitution and density changes made after the collider exists", () => {
    const { col, runtime } = spawn();

    col.friction = 0.25;
    col.restitution = 0.75;
    col.density = 2;
    h.frame();

    expect(runtime.getFriction()).toBe(0.25);
    expect(runtime.getRestitution()).toBe(0.75);
    expect(runtime.getDensity()).toBe(2);
  });

  it("writes nothing when no Collider2D field changed", () => {
    const { runtime } = spawn();

    expect(runtime.writes.total).toBe(0);

    h.frame();
    h.frame();
    h.frame();

    expect(runtime.writes.total).toBe(0);
  });

  it("writes each changed field exactly once, not once per frame", () => {
    const { col, runtime } = spawn();

    col.isSensor = true;
    h.frame();
    h.frame();
    h.frame();

    expect(runtime.writes.sensor).toBe(1);
    expect(runtime.writes.total).toBe(1);
  });

  it("does not re-write a float the backend cannot store exactly", () => {
    const { col, runtime } = spawn();

    col.friction = 0.3;
    h.frame();
    h.frame();
    h.frame();
    h.frame();

    expect(runtime.getFriction()).toBe(Math.fround(0.3));
    expect(runtime.writes.friction).toBe(1);
    expect(runtime.writes.total).toBe(1);
  });

  it("writes nothing for a collider born with values the backend cannot store exactly", () => {
    const entity: Entity = h.world.createEntity();
    h.world.addComponent(entity, Transform2D);
    const col: Collider2D = h.world.addComponent(entity, Collider2D, BOX);
    col.friction = 0.3;
    col.restitution = 0.1;
    col.density = 1.7;

    h.frame();
    h.frame();
    h.frame();

    const runtime: FakeCollider = [...h.physics.colliders][0];
    expect(runtime.writes.total).toBe(0);
  });

  it("marks the fields no backend setter can carry as readonly", () => {
    const col: Collider2D = new Collider2D(BOX);
    const cc: CharacterController2D = new CharacterController2D();

    // @ts-expect-error shape needs a collider rebuild, the sync pass cannot carry it
    col.shape = BOX;
    // @ts-expect-error offset needs a collider rebuild, the sync pass cannot carry it
    col.offset = col.offset;
    // @ts-expect-error CharacterController exposes no setter for offset
    cc.offset = 0.02;
    // @ts-expect-error CharacterController exposes no setter for slide
    cc.slide = false;
  });
});
