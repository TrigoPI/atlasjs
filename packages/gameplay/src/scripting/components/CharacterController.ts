import { Vec2 } from "@atlasjs/math";
import { Entity, NexusWorld } from "@atlasjs/nexus";

import { defineScriptComponent } from "../core";

import {
  CharacterController2D,
  CharacterControllerRef,
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

      return moved;
    },
  };
}

export const CharacterController = defineScriptComponent(
  CharacterController2D,
  createCharacterController,
);
