import { beforeEach, describe, expect, it } from "vitest";

import { ColliderShapeDesc } from "@atlasjs/inertia";
import { Vec2 } from "@atlasjs/math";
import { Entity } from "@atlasjs/nexus";

import {
  CharacterController2D,
  Collider2D,
  PhysicsBodyRef,
  PhysicsColliderRef,
  RigidBody2D,
  Transform2D,
} from "../src/components";

import { CharacterController } from "../src/scripting/components/CharacterController";
import type { CharacterController as CharacterControllerApi } from "../src/scripting/components/CharacterController";

import { FakeCharacterController } from "./helpers/fake-physics";
import { createHarness, Harness } from "./helpers/harness";

const BOX: ColliderShapeDesc = { type: "box", width: 10, height: 10 };
const WALL_X: number = 100;

function spawnWalker(h: Harness, withBody: boolean): Entity {
  const e: Entity = h.world.createEntity();
  h.world.addComponent(e, Transform2D);

  if (withBody) {
    const body: RigidBody2D = h.world.addComponent(e, RigidBody2D);
    body.type = "kinematic";
  }

  h.world.addComponent(e, Collider2D, BOX);
  h.world.addComponent(e, CharacterController2D);

  return e;
}

describe("CharacterController move() pushes the body immediately", () => {
  let h: Harness;
  let controller: FakeCharacterController;

  beforeEach(async () => {
    h = await createHarness();
  });

  it("does not walk through a wall when move() runs twice without an intervening fixed step", () => {
    const e: Entity = spawnWalker(h, true);
    h.frame();

    controller = [...h.physics.characterControllers][0];
    controller.wallX = WALL_X;

    const api: CharacterControllerApi = CharacterController.create(h.world, e);

    api.move(new Vec2(60, 0));
    api.move(new Vec2(60, 0));

    const t: Transform2D = h.world.requireComponent(e, Transform2D);
    expect(t.position.x).toBeCloseTo(WALL_X, 5);
  });

  it("lands two half moves on the same position as one whole move", () => {
    const whole: Entity = spawnWalker(h, true);
    const halves: Entity = spawnWalker(h, true);
    h.frame();

    for (const c of h.physics.characterControllers) {
      c.wallX = WALL_X;
    }

    const wholeApi: CharacterControllerApi = CharacterController.create(
      h.world,
      whole,
    );

    const halvesApi: CharacterControllerApi = CharacterController.create(
      h.world,
      halves,
    );

    wholeApi.move(new Vec2(120, 0));

    halvesApi.move(new Vec2(60, 0));
    halvesApi.move(new Vec2(60, 0));

    const a: Transform2D = h.world.requireComponent(whole, Transform2D);
    const b: Transform2D = h.world.requireComponent(halves, Transform2D);

    expect(a.position.x).toBeCloseTo(WALL_X, 5);
    expect(b.position.x).toBeCloseTo(a.position.x, 5);
  });

  it("keeps the physics body in step with the Transform2D inside a single frame", () => {
    const e: Entity = spawnWalker(h, true);
    h.frame();

    const api: CharacterControllerApi = CharacterController.create(h.world, e);
    api.move(new Vec2(30, -12));

    const t: Transform2D = h.world.requireComponent(e, Transform2D);
    const ref: PhysicsBodyRef = h.world.requireComponent(e, PhysicsBodyRef);

    expect(ref.body.getTranslation().x).toBeCloseTo(t.position.x, 5);
    expect(ref.body.getTranslation().y).toBeCloseTo(t.position.y, 5);
  });

  it("keeps the collider in step with its body inside a single frame", () => {
    const e: Entity = spawnWalker(h, true);
    h.frame();

    const api: CharacterControllerApi = CharacterController.create(h.world, e);
    api.move(new Vec2(30, -12));

    const bodyRef: PhysicsBodyRef = h.world.requireComponent(e, PhysicsBodyRef);
    const colliderRef: PhysicsColliderRef = h.world.requireComponent(
      e,
      PhysicsColliderRef,
    );

    expect(colliderRef.collider.getTranslation().x).toBeCloseTo(
      bodyRef.body.getTranslation().x,
      5,
    );
    expect(colliderRef.collider.getTranslation().y).toBeCloseTo(
      bodyRef.body.getTranslation().y,
      5,
    );
  });

  it("refuses to move an entity that carries no RigidBody2D", () => {
    const e: Entity = spawnWalker(h, false);
    h.frame();

    const api: CharacterControllerApi = CharacterController.create(h.world, e);

    expect(() => api.move(new Vec2(10, 0))).toThrowError(/RigidBody2D/);
  });
});
