import { describe, expect, it } from "vitest";
import { Vec2 } from "@atlasjs/math";
import { NexusWorld, ComponentRegistry } from "@atlasjs/nexus";
import type { Entity } from "@atlasjs/nexus";
import { Collider2D } from "../src/components/Collider2D";
import { Transform2D } from "../src/components/Transform2D";
import { CharacterController2D } from "../src/components/CharacterController2D";
import { CharacterControllerRef } from "../src/components/CharacterControllerRef";
import { PhysicsBodyRef } from "../src/components/PhysicsBodyRef";
import { PhysicsColliderRef } from "../src/components/PhysicsColliderRef";
import { CharacterController } from "../src/scripting/components/CharacterController";
import {
  FakeCharacterController,
  FakeCollider,
  FakePhysicsWorld,
  FakeRigidBody,
} from "./helpers/fake-physics";
import type { CharacterController as CharacterControllerApi } from "../src/scripting/components/CharacterController";

describe("CharacterController token move()", () => {
  it("applies the collide-and-slide corrected delta to the Transform2D", () => {
    const world: NexusWorld = new NexusWorld(new ComponentRegistry());
    world
      .defineComponent(Transform2D)
      .defineComponent(CharacterController2D)
      .defineComponent(CharacterControllerRef)
      .defineComponent(PhysicsBodyRef)
      .defineComponent(PhysicsColliderRef);

    const e: Entity = world.createEntity();
    world.addComponent(e, Transform2D);
    world.addComponent(e, CharacterController2D);

    const physics: FakePhysicsWorld = new FakePhysicsWorld();

    const body: FakeRigidBody = physics.createRigidBody({
      type: "kinematic",
    }) as FakeRigidBody;
    world.addComponent(e, PhysicsBodyRef, body);

    const collider: FakeCollider = physics.createCollider(
      { shape: { type: "circle", radius: 1 } },
      body,
    ) as FakeCollider;
    world.addComponent(
      e,
      PhysicsColliderRef,
      collider,
      new Collider2D({ type: "circle", radius: 1 }),
    );

    const controller: FakeCharacterController = new FakeCharacterController();
    controller.factor = 0.5;
    world.addComponent(e, CharacterControllerRef, controller, physics);

    const api: CharacterControllerApi = CharacterController.create(world, e);
    const moved: Vec2 = api.move(new Vec2(10, 4));

    expect(moved.x).toBe(5);
    expect(moved.y).toBe(2);
    expect(controller.lastCollider).toBe(collider);

    const t: Transform2D = world.requireComponent(e, Transform2D);
    expect(t.position.x).toBe(5);
    expect(t.position.y).toBe(2);

    expect(body.getTranslation().x).toBe(5);
    expect(body.getTranslation().y).toBe(2);
  });
});
