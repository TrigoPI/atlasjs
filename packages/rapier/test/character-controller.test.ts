import { describe, expect, it } from "vitest";
import { Vec2 } from "@atlasjs/math";
import { ALL_LAYERS } from "@atlasjs/inertia";
import type { Collider, RigidBody, CharacterController } from "@atlasjs/inertia";
import { RapierPhysicsWorld } from "../src/RapierPhysicsWorld";

async function makeWorld(): Promise<RapierPhysicsWorld> {
  const world: RapierPhysicsWorld = new RapierPhysicsWorld({
    gravity: new Vec2(0, 0),
    unitsPerMeter: 100,
  });
  await world.init();
  return world;
}

describe("RapierCharacterController collide-and-slide", () => {
  it("clamps movement into a static box and returns world units", async () => {
    const world: RapierPhysicsWorld = await makeWorld();

    world.createCollider({
      shape: { type: "box", width: 200, height: 200 },
      translation: new Vec2(0, 0),
      collisionGroup: ALL_LAYERS,
      collisionMask: ALL_LAYERS,
    });

    const body: RigidBody = world.createRigidBody({
      type: "kinematic",
      translation: new Vec2(-300, 0),
    });
    const player: Collider = world.createCollider(
      {
        shape: { type: "circle", radius: 50 },
        collisionGroup: ALL_LAYERS,
        collisionMask: ALL_LAYERS,
      },
      body,
    );

    world.step(1 / 60);

    const controller: CharacterController = world.createCharacterController({ slide: true });
    const moved: Vec2 = controller.computeMovement(player, new Vec2(300, 0));

    expect(moved.x).toBeLessThan(300);
    expect(moved.x).toBeGreaterThan(100);
    expect(moved.x).toBeLessThan(200);
  });

  it("allows full movement in free space", async () => {
    const world: RapierPhysicsWorld = await makeWorld();
    const body: RigidBody = world.createRigidBody({ type: "kinematic", translation: new Vec2(0, 0) });
    const player: Collider = world.createCollider(
      { shape: { type: "circle", radius: 50 }, collisionGroup: ALL_LAYERS, collisionMask: ALL_LAYERS },
      body,
    );
    world.step(1 / 60);

    const controller: CharacterController = world.createCharacterController({});
    const moved: Vec2 = controller.computeMovement(player, new Vec2(300, 0));

    expect(moved.x).toBeGreaterThan(290);
  });
});
