import { Mat3, Vec2 } from "@atlasjs/math";
import { Entity, NexusWorld } from "@atlasjs/nexus";

import { defineScriptComponent } from "../core";

import {
  PhysicsBodyRef,
  RigidBody2D,
  Transform2D,
  WorldTransform2D,
} from "../../components";

const ENTITY: unique symbol = Symbol("Transform.entity");

export interface Transform {
  parent: Transform | null;
  position: Vec2;
  rotation: number;
  scale: Vec2;
  readonly worldPosition: Vec2;
  setPosition(x: number, y: number): Transform;
  setRotation(rotation: number): Transform;
  setScale(x: number, y: number): Transform;
  translate(dx: number, dy: number): Transform;
  rotate(angle: number): Transform;
  setParent(parent: Transform | null, worldPositionStays?: boolean): Transform;
  getChildren(): Transform[];
}

type TransformHandle = Transform & { readonly [ENTITY]: Entity };

function worldMatrix(world: NexusWorld, entity: Entity): Mat3 {
  const wt: WorldTransform2D | undefined = world.getComponent(
    entity,
    WorldTransform2D,
  );

  return wt !== undefined
    ? wt.matrix.clone()
    : Mat3.fromTransform2D(world.requireComponent(entity, Transform2D));
}

function controllingBody(
  world: NexusWorld,
  entity: Entity,
): PhysicsBodyRef | undefined {
  const rigidBody: RigidBody2D | undefined = world.getComponent(
    entity,
    RigidBody2D,
  );

  if (rigidBody === undefined || rigidBody.type !== "dynamic") {
    return undefined;
  }

  return world.getComponent(entity, PhysicsBodyRef);
}

function entityOf(transform: Transform): Entity {
  return (transform as TransformHandle)[ENTITY];
}

function createTransform(world: NexusWorld, entity: Entity): Transform {
  const api: TransformHandle = {
    [ENTITY]: entity,

    get parent(): Transform | null {
      const parentEntity: Entity | undefined = world.getParent(entity);
      return parentEntity !== undefined
        ? createTransform(world, parentEntity)
        : null;
    },

    get position(): Vec2 {
      return world.requireComponent(entity, Transform2D).position;
    },

    set position(value: Vec2) {
      this.setPosition(value.x, value.y);
    },

    get worldPosition(): Vec2 {
      return worldMatrix(world, entity).getTranslation();
    },

    get rotation(): number {
      return world.requireComponent(entity, Transform2D).rotation;
    },

    set rotation(value: number) {
      this.setRotation(value);
    },

    get scale(): Vec2 {
      return world.requireComponent(entity, Transform2D).scale;
    },

    set scale(value: Vec2) {
      this.setScale(value.x, value.y);
    },

    setPosition(x: number, y: number): Transform {
      world.requireComponent(entity, Transform2D).position.set(x, y);

      const body: PhysicsBodyRef | undefined = controllingBody(world, entity);
      if (body !== undefined) {
        body.body.setTranslation(x, y);
      }

      return this;
    },

    setRotation(rotation: number): Transform {
      world.requireComponent(entity, Transform2D).rotation = rotation;

      const body: PhysicsBodyRef | undefined = controllingBody(world, entity);
      if (body !== undefined) {
        body.body.setRotation(rotation);
      }

      return this;
    },

    setScale(x: number, y: number): Transform {
      world.requireComponent(entity, Transform2D).scale.set(x, y);
      return this;
    },

    translate(dx: number, dy: number): Transform {
      const position: Vec2 = world.requireComponent(
        entity,
        Transform2D,
      ).position;
      return this.setPosition(position.x + dx, position.y + dy);
    },

    rotate(angle: number): Transform {
      return this.setRotation(
        world.requireComponent(entity, Transform2D).rotation + angle,
      );
    },

    setParent(
      parent: Transform | null,
      worldPositionStays: boolean = true,
    ): Transform {
      if (!worldPositionStays) {
        world.setParent(entity, parent !== null ? entityOf(parent) : null);
        return this;
      }

      const currentWorld: Mat3 = worldMatrix(world, entity);

      world.setParent(entity, parent !== null ? entityOf(parent) : null);

      const parentWorld: Mat3 | null =
        parent !== null ? worldMatrix(world, entityOf(parent)) : null;

      const localMatrix: Mat3 =
        parentWorld !== null
          ? parentWorld.invert().multiply(currentWorld)
          : currentWorld;

      const transform: Transform2D = world.requireComponent(
        entity,
        Transform2D,
      );
      const position: Vec2 = localMatrix.getTranslation();
      const scale: Vec2 = localMatrix.getScale();

      transform.position.set(position.x, position.y);
      transform.rotation = localMatrix.getRotation();
      transform.scale.set(scale.x, scale.y);

      return this;
    },

    getChildren(): Transform[] {
      const children: ReadonlyArray<Entity> = world.getChildren(entity);
      const result: Transform[] = [];
      for (let i: number = 0; i < children.length; i++) {
        if (world.hasComponent(children[i], Transform2D)) {
          result.push(createTransform(world, children[i]));
        }
      }
      return result;
    },
  };

  return api;
}

export const Transform = defineScriptComponent(Transform2D, createTransform);
