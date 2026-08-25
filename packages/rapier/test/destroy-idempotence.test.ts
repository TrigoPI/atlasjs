import RAPIER from "@dimforge/rapier2d-compat";
import { describe, expect, it } from "vitest";
import { Vec2 } from "@atlasjs/math";
import { ALL_LAYERS } from "@atlasjs/inertia";
import type {
  CharacterController,
  Collider,
  RigidBody,
} from "@atlasjs/inertia";
import { RapierPhysicsWorld } from "../src/RapierPhysicsWorld";

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

function makeBox(
  world: RapierPhysicsWorld,
  body: RigidBody | undefined,
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

describe("RapierPhysicsWorld destroyRigidBody", () => {
  it("destroys the body and cascades to its attached colliders", async () => {
    const world: RapierPhysicsWorld = await makeWorld();
    const body: RigidBody = world.createRigidBody({
      type: "kinematic",
      translation: new Vec2(0, 0),
    });
    makeBox(world, body, new Vec2(0, 0));
    world.step(1 / 60);

    expect(world.query().intersectPoint(new Vec2(0, 0))).toHaveLength(1);

    world.destroyRigidBody(body);
    world.step(1 / 60);

    expect(world.query().intersectPoint(new Vec2(0, 0))).toHaveLength(0);
    expect(rawWorld(world).bodies.len()).toBe(0);
    expect(rawWorld(world).colliders.len()).toBe(0);
  });

  it("is a no-op when the same body is destroyed twice", async () => {
    const world: RapierPhysicsWorld = await makeWorld();
    const body: RigidBody = world.createRigidBody({
      type: "kinematic",
      translation: new Vec2(0, 0),
    });
    makeBox(world, body, new Vec2(0, 0));

    world.destroyRigidBody(body);
    expect(() => world.destroyRigidBody(body)).not.toThrow();

    const survivor: RigidBody = world.createRigidBody({
      type: "kinematic",
      translation: new Vec2(500, 0),
    });
    makeBox(world, survivor, new Vec2(0, 0));
    world.step(1 / 60);

    expect(world.query().intersectPoint(new Vec2(500, 0))).toHaveLength(1);
  });

  it("is a no-op when a body destroyed by clear() is destroyed again", async () => {
    const world: RapierPhysicsWorld = await makeWorld();
    const body: RigidBody = world.createRigidBody({
      type: "kinematic",
      translation: new Vec2(0, 0),
    });
    makeBox(world, body, new Vec2(0, 0));

    world.clear();
    expect(() => world.destroyRigidBody(body)).not.toThrow();

    const survivor: RigidBody = world.createRigidBody({
      type: "kinematic",
      translation: new Vec2(500, 0),
    });
    makeBox(world, survivor, new Vec2(0, 0));
    world.step(1 / 60);

    expect(world.query().intersectPoint(new Vec2(500, 0))).toHaveLength(1);
  });
});

describe("RapierPhysicsWorld destroyCharacterController", () => {
  it("is a no-op when the same controller is destroyed twice", async () => {
    const world: RapierPhysicsWorld = await makeWorld();
    const controller: CharacterController = world.createCharacterController({});

    world.destroyCharacterController(controller);
    expect(() => world.destroyCharacterController(controller)).not.toThrow();

    const body: RigidBody = world.createRigidBody({
      type: "kinematic",
      translation: new Vec2(0, 0),
    });
    const player: Collider = makeBox(world, body, new Vec2(0, 0));
    world.step(1 / 60);

    const next: CharacterController = world.createCharacterController({});
    expect(() => next.computeMovement(player, new Vec2(10, 0))).not.toThrow();
  });

  it("is a no-op when a controller destroyed by clear() is destroyed again", async () => {
    const world: RapierPhysicsWorld = await makeWorld();
    const controller: CharacterController = world.createCharacterController({});

    world.clear();
    expect(() => world.destroyCharacterController(controller)).not.toThrow();

    const body: RigidBody = world.createRigidBody({
      type: "kinematic",
      translation: new Vec2(0, 0),
    });
    const player: Collider = makeBox(world, body, new Vec2(0, 0));
    world.step(1 / 60);

    const next: CharacterController = world.createCharacterController({});
    expect(() => next.computeMovement(player, new Vec2(10, 0))).not.toThrow();
  });
});

describe("RapierPhysicsWorld clear", () => {
  it("empties the rapier world and leaves the wrapper usable", async () => {
    const world: RapierPhysicsWorld = await makeWorld();
    const body: RigidBody = world.createRigidBody({
      type: "kinematic",
      translation: new Vec2(0, 0),
    });
    makeBox(world, body, new Vec2(0, 0));
    makeBox(world, undefined, new Vec2(400, 0));
    world.createCharacterController({});
    world.step(1 / 60);

    world.clear();
    world.step(1 / 60);

    expect(rawWorld(world).bodies.len()).toBe(0);
    expect(rawWorld(world).colliders.len()).toBe(0);
    expect(world.query().intersectPoint(new Vec2(0, 0))).toHaveLength(0);
    expect(world.query().intersectPoint(new Vec2(400, 0))).toHaveLength(0);

    const rebuilt: RigidBody = world.createRigidBody({
      type: "kinematic",
      translation: new Vec2(0, 0),
    });
    makeBox(world, rebuilt, new Vec2(0, 0));
    world.step(1 / 60);

    expect(world.query().intersectPoint(new Vec2(0, 0))).toHaveLength(1);
  });
});
