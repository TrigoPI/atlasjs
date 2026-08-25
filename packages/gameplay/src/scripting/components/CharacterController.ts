import { RigidBody } from "@atlasjs/inertia";
import { Vec2 } from "@atlasjs/math";
import { Entity, NexusWorld } from "@atlasjs/nexus";

import { defineScriptComponent } from "../core";

import {
  CharacterController2D,
  CharacterControllerRef,
  PhysicsBodyRef,
  PhysicsColliderRef,
  Transform2D,
} from "../../components";

export interface CharacterController {
  move(delta: Vec2): Vec2;
}

function createCharacterController(
  world: NexusWorld,
  entity: Entity,
): CharacterController {
  return {
    move(delta: Vec2): Vec2 {
      const ref: CharacterControllerRef = world.requireComponent(
        entity,
        CharacterControllerRef,
      );

      const colliderRef: PhysicsColliderRef = world.requireComponent(
        entity,
        PhysicsColliderRef,
      );

      const bodyRef: PhysicsBodyRef | undefined = world.getComponent(
        entity,
        PhysicsBodyRef,
      );

      if (bodyRef === undefined) {
        throw new Error(
          "CharacterController.move() requires a RigidBody2D on the entity: a body-less collider is never repositioned, so the controller would keep colliding from the spawn position.",
        );
      }

      const transform: Transform2D = world.requireComponent(
        entity,
        Transform2D,
      );

      const moved: Vec2 = ref.controller.computeMovement(
        colliderRef.collider,
        delta,
      );

      transform.position.set(
        transform.position.x + moved.x,
        transform.position.y + moved.y,
      );

      const body: RigidBody = bodyRef.body;
      const origin: Vec2 = body.getTranslation();

      body.setTranslation(origin.x + moved.x, origin.y + moved.y);

      return moved;
    },
  };
}

export const CharacterController = defineScriptComponent(
  CharacterController2D,
  createCharacterController,
);
