import RAPIER from "@dimforge/rapier2d-compat";
import { describe, expect, it } from "vitest";
import { Vec2 } from "@atlasjs/math";
import type { CharacterController, RigidBody } from "@atlasjs/inertia";
import { RapierPhysicsWorld } from "../src/RapierPhysicsWorld";
import { RapierCharacterController } from "../src/RapierCharacterController";
import { EARTH_GRAVITY } from "../src/rapier-const";

interface RawWorldHost {
  world: RAPIER.World;
}

function rawGravity(world: RapierPhysicsWorld): RAPIER.Vector {
  return (world as unknown as RawWorldHost).world.gravity;
}

async function makeWorld(
  unitsPerMeter: number,
  gravity?: Vec2,
): Promise<RapierPhysicsWorld> {
  const world: RapierPhysicsWorld = new RapierPhysicsWorld({
    gravity,
    unitsPerMeter,
  });
  await world.init();
  return world;
}

describe("RapierPhysicsWorld gravity units", () => {
  it("round-trips setGravity/getGravity in world units at unitsPerMeter 1", async () => {
    const world: RapierPhysicsWorld = await makeWorld(1);
    world.setGravity(0, -9.81);

    expect(world.getGravity().y).toBeCloseTo(-9.81, 6);
    expect(rawGravity(world).y).toBeCloseTo(-9.81, 6);
  });

  it("converts setGravity from world units to physics units", async () => {
    const world: RapierPhysicsWorld = await makeWorld(100);
    world.setGravity(0, -980);

    expect(rawGravity(world).y).toBeCloseTo(-9.8, 6);
  });

  it("round-trips setGravity/getGravity in world units at unitsPerMeter 100", async () => {
    const world: RapierPhysicsWorld = await makeWorld(100);
    world.setGravity(0, -980);

    expect(world.getGravity().y).toBeCloseTo(-980, 6);
  });

  it("converts the configured gravity option from world units", async () => {
    const world: RapierPhysicsWorld = await makeWorld(100, new Vec2(0, 980));

    expect(rawGravity(world).y).toBeCloseTo(9.8, 6);
    expect(world.getGravity().y).toBeCloseTo(980, 6);
  });

  it("keeps the default gravity at earth scale whatever the unit scale", async () => {
    const world: RapierPhysicsWorld = await makeWorld(100);

    expect(rawGravity(world).y).toBeCloseTo(EARTH_GRAVITY, 6);
    expect(world.getGravity().y).toBeCloseTo(EARTH_GRAVITY * 100, 6);
  });

  it("makes a body fall the same world distance whatever the unit scale", async () => {
    const unscaled: RapierPhysicsWorld = await makeWorld(1, new Vec2(0, 10));
    const scaled: RapierPhysicsWorld = await makeWorld(100, new Vec2(0, 1000));

    const a: RigidBody = unscaled.createRigidBody({
      type: "dynamic",
      translation: new Vec2(0, 0),
    });

    const b: RigidBody = scaled.createRigidBody({
      type: "dynamic",
      translation: new Vec2(0, 0),
    });

    unscaled.createCollider(
      { shape: { type: "box", width: 1, height: 1 }, density: 1 },
      a,
    );

    scaled.createCollider(
      { shape: { type: "box", width: 100, height: 100 }, density: 1 },
      b,
    );

    for (let i: number = 0; i < 60; i++) {
      unscaled.step(1 / 60);
      scaled.step(1 / 60);
    }

    expect(b.getTranslation().y).toBeCloseTo(a.getTranslation().y * 100, 3);
  });
});

describe("RapierPhysicsWorld character controller offset units", () => {
  it("converts the configured offset from world units", async () => {
    const world: RapierPhysicsWorld = await makeWorld(100);
    const controller: CharacterController = world.createCharacterController({
      offset: 1,
    });

    expect((controller as RapierCharacterController).raw.offset()).toBeCloseTo(
      0.01,
      6,
    );
  });

  it("leaves the offset untouched at unitsPerMeter 1", async () => {
    const world: RapierPhysicsWorld = await makeWorld(1);
    const controller: CharacterController = world.createCharacterController({
      offset: 0.05,
    });

    expect((controller as RapierCharacterController).raw.offset()).toBeCloseTo(
      0.05,
      6,
    );
  });
});
