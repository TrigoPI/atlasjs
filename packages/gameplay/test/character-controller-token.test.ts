import { describe, expect, it } from "vitest";
import { Vec2 } from "@atlasjs/math";
import { NexusWorld, ComponentRegistry } from "@atlasjs/nexus";
import type { Entity } from "@atlasjs/nexus";
import { Transform2D } from "../src/components/Transform2D";
import { CharacterController2D } from "../src/components/CharacterController2D";
import { CharacterControllerRef } from "../src/components/CharacterControllerRef";
import { PhysicsColliderRef } from "../src/components/PhysicsColliderRef";
import { CharacterController } from "../src/scripting/components/CharacterController";
import { FakeCharacterController, FakeCollider } from "./helpers/fake-physics";
import type { CharacterController as CharacterControllerApi } from "../src/scripting/components/CharacterController";

describe("CharacterController token move()", () => {
  it("applies the collide-and-slide corrected delta to the Transform2D", () => {
    const world: NexusWorld = new NexusWorld(new ComponentRegistry());
    world
      .defineComponent(Transform2D)
      .defineComponent(CharacterController2D)
      .defineComponent(CharacterControllerRef)
      .defineComponent(PhysicsColliderRef);

    const e: Entity = world.createEntity();
    world.addComponent(e, Transform2D);
    world.addComponent(e, CharacterController2D);

    const collider: FakeCollider = new FakeCollider(
      "c",
      { shape: { type: "circle", radius: 1 } },
      null,
    );
    world.addComponent(e, PhysicsColliderRef, collider);

    const controller: FakeCharacterController = new FakeCharacterController();
    controller.factor = 0.5;
    world.addComponent(e, CharacterControllerRef, controller);

    const api: CharacterControllerApi = CharacterController.create(world, e);
    const moved: Vec2 = api.move(new Vec2(10, 4));

    expect(moved.x).toBe(5);
    expect(moved.y).toBe(2);
    expect(controller.lastCollider).toBe(collider);

    const t: Transform2D = world.requireComponent(e, Transform2D);
    expect(t.position.x).toBe(5);
    expect(t.position.y).toBe(2);
  });
});
