import { describe, expect, it } from "vitest";
import { Vec2 } from "@atlasjs/math";
import { ALL_LAYERS } from "@atlasjs/inertia";
import type { Collider, RigidBody } from "@atlasjs/inertia";
import { RapierPhysicsWorld } from "../src/RapierPhysicsWorld";

const UNITS_PER_METER: number = 100;
const STEP: number = 1 / 60;
const RIDE_STEPS: number = 60;
const STEP_DISTANCE: number = 5;

type Scene = {
  world: RapierPhysicsWorld;
  platform: RigidBody;
  crate: RigidBody;
};

function box(
  world: RapierPhysicsWorld,
  body: RigidBody,
  width: number,
  height: number,
): Collider {
  return world.createCollider(
    {
      shape: { type: "box", width, height },
      collisionGroup: ALL_LAYERS,
      collisionMask: ALL_LAYERS,
      friction: 1,
      density: 1,
    },
    body,
  );
}

async function restingCrateOnPlatform(): Promise<Scene> {
  const world: RapierPhysicsWorld = new RapierPhysicsWorld({
    gravity: new Vec2(0, 1000),
    unitsPerMeter: UNITS_PER_METER,
  });

  await world.init();

  const platform: RigidBody = world.createRigidBody({
    type: "kinematic",
    translation: new Vec2(0, 200),
  });

  box(world, platform, 400, 40);

  const crate: RigidBody = world.createRigidBody({
    type: "dynamic",
    translation: new Vec2(0, 159),
  });

  box(world, crate, 40, 40);

  for (let i: number = 0; i < RIDE_STEPS; i++) {
    world.step(STEP);
  }

  return { world, platform, crate };
}

describe("kinematic platform carries a dynamic body", () => {
  it("pushes the crate when driven by setNextKinematicTranslation", async () => {
    const scene: Scene = await restingCrateOnPlatform();
    const restingY: number = scene.crate.getTranslation().y;

    for (let i: number = 0; i < RIDE_STEPS; i++) {
      const at: Vec2 = scene.platform.getTranslation();
      scene.platform.setNextKinematicTranslation(at.x + STEP_DISTANCE, at.y);
      scene.world.step(STEP);
    }

    const platformX: number = scene.platform.getTranslation().x;
    const crateTranslation: Vec2 = scene.crate.getTranslation();

    expect(platformX).toBeCloseTo(RIDE_STEPS * STEP_DISTANCE, 2);
    expect(crateTranslation.x).toBeGreaterThan(platformX * 0.75);
    expect(crateTranslation.y).toBeCloseTo(restingY, 1);
    expect(scene.crate.getLinearVelocity().x).toBeGreaterThan(0);
  });

  it("leaves the crate behind when driven by setTranslation", async () => {
    const scene: Scene = await restingCrateOnPlatform();

    for (let i: number = 0; i < RIDE_STEPS; i++) {
      const at: Vec2 = scene.platform.getTranslation();
      scene.platform.setTranslation(at.x + STEP_DISTANCE, at.y);
      scene.world.step(STEP);
    }

    const platformX: number = scene.platform.getTranslation().x;

    expect(platformX).toBeCloseTo(RIDE_STEPS * STEP_DISTANCE, 2);
    expect(scene.crate.getTranslation().x).toBeLessThan(platformX * 0.1);
  });

  it("keeps setTranslation authoritative when it follows a pending kinematic target", async () => {
    const world: RapierPhysicsWorld = new RapierPhysicsWorld({
      gravity: new Vec2(0, 0),
      unitsPerMeter: UNITS_PER_METER,
    });

    await world.init();

    const body: RigidBody = world.createRigidBody({
      type: "kinematic",
      translation: new Vec2(0, 0),
    });

    box(world, body, 100, 100);
    world.step(STEP);

    body.setNextKinematicTranslation(500, 0);
    body.setTranslation(100, 0);

    expect(body.getTranslation().x).toBeCloseTo(100, 5);

    world.step(STEP);

    expect(body.getTranslation().x).toBeCloseTo(100, 5);
    expect(body.getLinearVelocity().x).toBeCloseTo(0, 5);
  });

  it("moves once, not twice, when a pending kinematic target follows setTranslation", async () => {
    const world: RapierPhysicsWorld = new RapierPhysicsWorld({
      gravity: new Vec2(0, 0),
      unitsPerMeter: UNITS_PER_METER,
    });

    await world.init();

    const body: RigidBody = world.createRigidBody({
      type: "kinematic",
      translation: new Vec2(0, 0),
    });

    box(world, body, 100, 100);
    world.step(STEP);

    body.setTranslation(100, 0);
    body.setNextKinematicTranslation(150, 0);
    world.step(STEP);

    expect(body.getTranslation().x).toBeCloseTo(150, 5);
    expect(body.getLinearVelocity().x).toBeCloseTo(50 / STEP, 0);
  });

  it("converts world units on the next-kinematic path", async () => {
    const world: RapierPhysicsWorld = new RapierPhysicsWorld({
      gravity: new Vec2(0, 0),
      unitsPerMeter: UNITS_PER_METER,
    });

    await world.init();

    const body: RigidBody = world.createRigidBody({
      type: "kinematic",
      translation: new Vec2(0, 0),
    });

    box(world, body, 100, 100);
    world.step(STEP);

    body.setNextKinematicTranslation(250, -125);
    world.step(STEP);

    const translation: Vec2 = body.getTranslation();

    expect(translation.x).toBeCloseTo(250, 5);
    expect(translation.y).toBeCloseTo(-125, 5);
  });
});
