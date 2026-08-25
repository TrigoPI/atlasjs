import { beforeEach, describe, expect, it } from "vitest";

import { ColliderShapeDesc } from "@atlasjs/inertia";
import { Mat3, Vec2 } from "@atlasjs/math";
import { Entity } from "@atlasjs/nexus";

import {
  CharacterController2D,
  Collider2D,
  PhysicsBodyRef,
  RigidBody2D,
  Transform2D,
} from "../src/components";

import { CharacterController } from "../src/scripting/components/CharacterController";
import type { CharacterController as CharacterControllerApi } from "../src/scripting/components/CharacterController";

import { FakeCharacterController } from "./helpers/fake-physics";
import { createHarness, Harness } from "./helpers/harness";

const BOX: ColliderShapeDesc = { type: "box", width: 10, height: 10 };

function spawnWalker(h: Harness, x: number, y: number): Entity {
  const e: Entity = h.world.createEntity();
  const transform: Transform2D = h.world.addComponent(e, Transform2D);
  transform.position.set(x, y);

  const body: RigidBody2D = h.world.addComponent(e, RigidBody2D);
  body.type = "kinematic";

  h.world.addComponent(e, Collider2D, BOX);
  h.world.addComponent(e, CharacterController2D);

  return e;
}

function spawnParent(
  h: Harness,
  x: number,
  y: number,
  rotation: number,
  scaleX: number,
  scaleY: number,
): Entity {
  const e: Entity = h.world.createEntity();
  const transform: Transform2D = h.world.addComponent(e, Transform2D);
  transform.position.set(x, y);
  transform.rotation = rotation;
  transform.scale.set(scaleX, scaleY);
  return e;
}

function worldPositionOf(h: Harness, parent: Entity, child: Entity): Vec2 {
  const parentMatrix: Mat3 = Mat3.fromTransform2D(
    h.world.requireComponent(parent, Transform2D),
  );

  const childMatrix: Mat3 = Mat3.fromTransform2D(
    h.world.requireComponent(child, Transform2D),
  );

  return parentMatrix.multiply(childMatrix).getTranslation();
}

describe("CharacterController move() under a transformed parent", () => {
  let h: Harness;

  beforeEach(async () => {
    h = await createHarness();
  });

  it("moves the entity by the world delta when the parent is rotated", () => {
    const parent: Entity = spawnParent(h, 100, 50, 0.7, 1, 1);
    const child: Entity = spawnWalker(h, 3, 4);
    h.world.setParent(child, parent);
    h.frame();
    h.frame();

    const before: Vec2 = worldPositionOf(h, parent, child);

    const api: CharacterControllerApi = CharacterController.create(
      h.world,
      child,
    );

    api.move(new Vec2(10, -6));

    const after: Vec2 = worldPositionOf(h, parent, child);

    expect(after.x).toBeCloseTo(before.x + 10, 3);
    expect(after.y).toBeCloseTo(before.y - 6, 3);
  });

  it("moves the entity by the world delta when the parent is scaled", () => {
    const parent: Entity = spawnParent(h, 0, 0, 0, 2, 4);
    const child: Entity = spawnWalker(h, 3, 4);
    h.world.setParent(child, parent);
    h.frame();
    h.frame();

    const before: Vec2 = worldPositionOf(h, parent, child);

    const api: CharacterControllerApi = CharacterController.create(
      h.world,
      child,
    );

    api.move(new Vec2(10, -8));

    const after: Vec2 = worldPositionOf(h, parent, child);

    expect(after.x).toBeCloseTo(before.x + 10, 3);
    expect(after.y).toBeCloseTo(before.y - 8, 3);

    const local: Transform2D = h.world.requireComponent(child, Transform2D);
    expect(local.position.x).toBeCloseTo(8, 3);
    expect(local.position.y).toBeCloseTo(2, 3);
  });

  it("keeps the body in step with the world position under a rotated parent", () => {
    const parent: Entity = spawnParent(h, 100, 50, 0.7, 1, 1);
    const child: Entity = spawnWalker(h, 3, 4);
    h.world.setParent(child, parent);
    h.frame();
    h.frame();

    const api: CharacterControllerApi = CharacterController.create(
      h.world,
      child,
    );

    api.move(new Vec2(10, -6));

    const world: Vec2 = worldPositionOf(h, parent, child);
    const ref: PhysicsBodyRef = h.world.requireComponent(child, PhysicsBodyRef);

    expect(ref.body.getTranslation().x).toBeCloseTo(world.x, 3);
    expect(ref.body.getTranslation().y).toBeCloseTo(world.y, 3);
  });

  it("leaves an unparented entity on exactly the arithmetic it used before", () => {
    const e: Entity = spawnWalker(h, 12.5, -7.25);
    h.frame();

    const controller: FakeCharacterController = [
      ...h.physics.characterControllers,
    ][0];
    controller.factor = 0.5;

    const api: CharacterControllerApi = CharacterController.create(h.world, e);
    api.move(new Vec2(10.1, 4.3));

    const t: Transform2D = h.world.requireComponent(e, Transform2D);
    expect(t.position.x).toBe(12.5 + 10.1 * 0.5);
    expect(t.position.y).toBe(-7.25 + 4.3 * 0.5);

    const ref: PhysicsBodyRef = h.world.requireComponent(e, PhysicsBodyRef);
    expect(ref.body.getTranslation().x).toBe(12.5 + 10.1 * 0.5);
    expect(ref.body.getTranslation().y).toBe(-7.25 + 4.3 * 0.5);
  });
});

describe("CharacterController move() return value", () => {
  let h: Harness;

  beforeEach(async () => {
    h = await createHarness();
  });

  it("does not mutate the vector returned by an earlier move()", () => {
    const e: Entity = spawnWalker(h, 0, 0);
    h.frame();

    const api: CharacterControllerApi = CharacterController.create(h.world, e);

    const first: Vec2 = api.move(new Vec2(10, 4));
    const firstX: number = first.x;
    const firstY: number = first.y;

    api.move(new Vec2(-3, 9));

    expect(first.x).toBe(firstX);
    expect(first.y).toBe(firstY);
  });

  it("hands back a vector the physics backend cannot reach", () => {
    const e: Entity = spawnWalker(h, 0, 0);
    h.frame();

    const controller: FakeCharacterController = [
      ...h.physics.characterControllers,
    ][0];

    const api: CharacterControllerApi = CharacterController.create(h.world, e);
    const moved: Vec2 = api.move(new Vec2(10, 4));

    expect(moved).not.toBe(controller.scratch);
    expect(moved.x).toBe(10);
    expect(moved.y).toBe(4);
  });
});
