import RAPIER from "@dimforge/rapier2d-compat";
import { describe, expect, it } from "vitest";
import { Vec2 } from "@atlasjs/math";
import { ALL_LAYERS } from "@atlasjs/inertia";
import type { Collider, RigidBody } from "@atlasjs/inertia";
import { RapierPhysicsWorld } from "../src/RapierPhysicsWorld";
import { RapierRigidBody } from "../src/RapierRigidBody";

interface RawWorldHost {
  world: RAPIER.World;
}

async function makeWorld(): Promise<RapierPhysicsWorld> {
  const world: RapierPhysicsWorld = new RapierPhysicsWorld({
    gravity: new Vec2(0, 0),
    unitsPerMeter: 100,
  });
  await world.init();
  return world;
}

function rawWorld(world: RapierPhysicsWorld): RAPIER.World {
  return (world as unknown as RawWorldHost).world;
}

function rawBody(body: RigidBody): RAPIER.RigidBody {
  return (body as RapierRigidBody).rapierBody;
}

function makeBox(
  world: RapierPhysicsWorld,
  body: RigidBody,
  at: Vec2,
): Collider {
  return world.createCollider(
    {
      shape: { type: "box", width: 100, height: 100 },
      translation: at,
      collisionGroup: ALL_LAYERS,
      collisionMask: ALL_LAYERS,
    },
    body,
  );
}

describe("RapierRigidBody setBodyType", () => {
  it("reports the new type without recreating the body", async () => {
    const world: RapierPhysicsWorld = await makeWorld();
    const body: RigidBody = world.createRigidBody({
      type: "dynamic",
      translation: new Vec2(0, 0),
    });

    expect(body.type).toBe("dynamic");

    body.setBodyType("kinematic");

    expect(body.type).toBe("kinematic");
    expect(rawWorld(world).bodies.len()).toBe(1);
  });

  it("preserves the rapier handle and the wrapper identity", async () => {
    const world: RapierPhysicsWorld = await makeWorld();
    const body: RigidBody = world.createRigidBody({
      type: "dynamic",
      translation: new Vec2(0, 0),
    });

    const handle: number = rawBody(body).handle;
    const id: string = body.id;

    body.setBodyType("static");

    expect(rawBody(body).handle).toBe(handle);
    expect(body.id).toBe(id);
    expect(rawWorld(world).bodies.get(handle)).toBe(rawBody(body));
  });

  it("keeps the attached colliders attached", async () => {
    const world: RapierPhysicsWorld = await makeWorld();
    const body: RigidBody = world.createRigidBody({
      type: "dynamic",
      translation: new Vec2(0, 0),
    });

    const collider: Collider = makeBox(world, body, new Vec2(0, 0));
    world.step(1 / 60);

    expect(rawWorld(world).colliders.len()).toBe(1);

    body.setBodyType("kinematic");
    world.step(1 / 60);

    expect(rawWorld(world).colliders.len()).toBe(1);
    expect(collider.getRigidBody()).toBe(body);
    expect(rawBody(body).numColliders()).toBe(1);
    expect(world.query().intersectPoint(new Vec2(0, 0))).toHaveLength(1);
  });

  it("preserves gravityScale and damping across the change", async () => {
    const world: RapierPhysicsWorld = await makeWorld();
    const body: RigidBody = world.createRigidBody({
      type: "dynamic",
      translation: new Vec2(0, 0),
    });

    body.setGravityScale(0);
    body.setLinearDamping(0.5);
    body.setAngularDamping(0.25);
    body.setUserData("payload");

    body.setBodyType("kinematic");

    expect(body.getGravityScale()).toBe(0);
    expect(body.getLinearDamping()).toBe(0.5);
    expect(body.getAngularDamping()).toBe(0.25);
    expect(body.getUserData<string>()).toBe("payload");
  });

  it("makes the body actually behave as its new type", async () => {
    const world: RapierPhysicsWorld = await makeWorld();
    world.setGravity(0, 1000);

    const body: RigidBody = world.createRigidBody({
      type: "dynamic",
      translation: new Vec2(0, 0),
    });

    makeBox(world, body, new Vec2(0, 0));

    for (let i: number = 0; i < 10; i++) {
      world.step(1 / 60);
    }

    expect(body.getTranslation().y).toBeGreaterThan(0);

    body.setBodyType("static");
    const frozen: number = body.getTranslation().y;

    for (let i: number = 0; i < 10; i++) {
      world.step(1 / 60);
    }

    expect(body.getTranslation().y).toBeCloseTo(frozen, 6);
  });
});
