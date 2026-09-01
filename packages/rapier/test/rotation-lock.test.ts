import { describe, expect, it } from "vitest";
import { Vec2 } from "@atlasjs/math";
import { ALL_LAYERS } from "@atlasjs/inertia";
import type { RigidBody, RigidBodyDesc } from "@atlasjs/inertia";
import { RapierPhysicsWorld } from "../src/RapierPhysicsWorld";

const STEP: number = 1 / 60;

async function makeWorld(): Promise<RapierPhysicsWorld> {
  const world: RapierPhysicsWorld = new RapierPhysicsWorld({
    gravity: new Vec2(0, 0),
    unitsPerMeter: 100,
  });
  await world.init();
  return world;
}

function spawnSpinner(
  world: RapierPhysicsWorld,
  desc: RigidBodyDesc = {},
): RigidBody {
  const body: RigidBody = world.createRigidBody({
    type: "dynamic",
    translation: new Vec2(0, 0),
    ...desc,
  });

  world.createCollider(
    {
      shape: { type: "box", width: 100, height: 100 },
      collisionGroup: ALL_LAYERS,
      collisionMask: ALL_LAYERS,
      density: 1,
    },
    body,
  );

  return body;
}

function advance(world: RapierPhysicsWorld, steps: number): void {
  for (let i: number = 0; i < steps; i++) {
    world.step(STEP);
  }
}

describe("RapierRigidBody rotation lock", () => {
  it("accumulates rotation from an angular impulse when unlocked", async () => {
    const world: RapierPhysicsWorld = await makeWorld();
    const body: RigidBody = spawnSpinner(world);

    body.applyAngularImpulse(0.05);
    advance(world, 10);

    expect(body.isRotationLocked()).toBe(false);
    expect(body.getAngularVelocity()).toBeGreaterThan(0);
    expect(body.getRotation()).toBeGreaterThan(0.01);
  });

  it("keeps the rotation at 0 when the desc locks it", async () => {
    const world: RapierPhysicsWorld = await makeWorld();
    const body: RigidBody = spawnSpinner(world, { lockRotation: true });

    body.applyAngularImpulse(0.05);
    advance(world, 10);

    expect(body.isRotationLocked()).toBe(true);
    expect(body.getRotation()).toBe(0);
    expect(body.getAngularVelocity()).toBe(0);
  });

  it("lets the desc lock win over a contradictory initial angularVelocity", async () => {
    const world: RapierPhysicsWorld = await makeWorld();
    const body: RigidBody = spawnSpinner(world, {
      angularVelocity: 2,
      lockRotation: true,
    });

    advance(world, 10);

    expect(body.getRotation()).toBe(0);
    expect(body.getAngularVelocity()).toBe(0);
  });

  it("stops an already-spinning body when locked at runtime", async () => {
    const world: RapierPhysicsWorld = await makeWorld();
    const body: RigidBody = spawnSpinner(world);

    body.setAngularVelocity(2);
    advance(world, 5);

    const spun: number = body.getRotation();
    expect(spun).toBeGreaterThan(0.01);

    body.setRotationLocked(true);
    advance(world, 30);

    expect(body.isRotationLocked()).toBe(true);
    expect(body.getRotation()).toBeCloseTo(spun, 6);
  });

  it("ignores an angular impulse once locked at runtime", async () => {
    const world: RapierPhysicsWorld = await makeWorld();
    const body: RigidBody = spawnSpinner(world);

    body.setRotationLocked(true);
    advance(world, 2);

    const settled: number = body.getRotation();

    body.applyAngularImpulse(5);
    advance(world, 30);

    expect(body.getRotation()).toBeCloseTo(settled, 6);
  });

  it("rotates again after the lock is released", async () => {
    const world: RapierPhysicsWorld = await makeWorld();
    const body: RigidBody = spawnSpinner(world, { lockRotation: true });

    body.applyAngularImpulse(0.05);
    advance(world, 10);
    expect(body.getRotation()).toBe(0);

    body.setRotationLocked(false);
    expect(body.isRotationLocked()).toBe(false);

    body.applyAngularImpulse(0.05);
    advance(world, 10);

    expect(body.getRotation()).toBeGreaterThan(0.01);
  });

  it("reflects both the desc and the setter through isRotationLocked", async () => {
    const world: RapierPhysicsWorld = await makeWorld();

    const unlocked: RigidBody = spawnSpinner(world);
    expect(unlocked.isRotationLocked()).toBe(false);

    const locked: RigidBody = spawnSpinner(world, { lockRotation: true });
    expect(locked.isRotationLocked()).toBe(true);

    expect(unlocked.setRotationLocked(true).isRotationLocked()).toBe(true);
    expect(locked.setRotationLocked(false).isRotationLocked()).toBe(false);
  });
  it("does not rotate when struck off-centre by another dynamic body", async () => {
    const world: RapierPhysicsWorld = await makeWorld();
    const struck: RigidBody = spawnSpinner(world, { lockRotation: true });
    const striker: RigidBody = spawnSpinner(world, {
      translation: new Vec2(300, 60),
      linearVelocity: new Vec2(-400, 0),
    });

    advance(world, 60);

    expect(striker.getTranslation().x).toBeLessThan(300);
    expect(struck.getTranslation().x).toBeLessThan(-1);
    expect(struck.isRotationLocked()).toBe(true);
    expect(struck.getRotation()).toBe(0);
    expect(struck.getAngularVelocity()).toBe(0);
  });

  it("rotates when struck off-centre while unlocked", async () => {
    const world: RapierPhysicsWorld = await makeWorld();
    const struck: RigidBody = spawnSpinner(world);
    spawnSpinner(world, {
      translation: new Vec2(300, 60),
      linearVelocity: new Vec2(-400, 0),
    });

    advance(world, 60);

    expect(struck.isRotationLocked()).toBe(false);
    expect(struck.getTranslation().x).toBeLessThan(-1);
    expect(Math.abs(struck.getRotation())).toBeGreaterThan(0.01);
  });
});
