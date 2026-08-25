import { Mat3, Vec2 } from "@atlasjs/math";
import { Entity, NexusWorld } from "@atlasjs/nexus";

import { defineScriptComponent } from "../core";

import {
  PhysicsBodyRef,
  Transform2D,
  WorldTransform2D,
} from "../../components";

import { isDynamicBody, worldMatrix } from "./hierarchy";

const ENTITY: unique symbol = Symbol("Transform.entity");

export interface Transform {
  readonly parent: Transform | null;
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

function controllingBody(
  world: NexusWorld,
  entity: Entity,
): PhysicsBodyRef | undefined {
  if (!isDynamicBody(world, entity)) {
    return undefined;
  }

  return world.getComponent(entity, PhysicsBodyRef);
}

function entityOf(transform: Transform): Entity {
  return (transform as TransformHandle)[ENTITY];
}

class TransformHandle implements Transform {
  public readonly [ENTITY]: Entity;

  private readonly world: NexusWorld;

  public constructor(world: NexusWorld, entity: Entity) {
    this.world = world;
    this[ENTITY] = entity;
  }

  public get parent(): Transform | null {
    const parentEntity: Entity | undefined = this.world.getParent(this[ENTITY]);

    return parentEntity !== undefined
      ? new TransformHandle(this.world, parentEntity)
      : null;
  }

  public get position(): Vec2 {
    return this.world.requireComponent(this[ENTITY], Transform2D).position;
  }

  public set position(value: Vec2) {
    this.setPosition(value.x, value.y);
  }

  public get worldPosition(): Vec2 {
    const wt: WorldTransform2D | undefined = this.world.getComponent(
      this[ENTITY],
      WorldTransform2D,
    );

    return wt !== undefined
      ? wt.getPosition()
      : worldMatrix(this.world, this[ENTITY]).getTranslation();
  }

  public get rotation(): number {
    return this.world.requireComponent(this[ENTITY], Transform2D).rotation;
  }

  public set rotation(value: number) {
    this.setRotation(value);
  }

  public get scale(): Vec2 {
    return this.world.requireComponent(this[ENTITY], Transform2D).scale;
  }

  public set scale(value: Vec2) {
    this.setScale(value.x, value.y);
  }

  public setPosition(x: number, y: number): Transform {
    this.world.requireComponent(this[ENTITY], Transform2D).position.set(x, y);

    const body: PhysicsBodyRef | undefined = controllingBody(
      this.world,
      this[ENTITY],
    );

    if (body !== undefined) {
      body.body.setTranslation(x, y);
    }

    return this;
  }

  public setRotation(rotation: number): Transform {
    this.world.requireComponent(this[ENTITY], Transform2D).rotation = rotation;

    const body: PhysicsBodyRef | undefined = controllingBody(
      this.world,
      this[ENTITY],
    );

    if (body !== undefined) {
      body.body.setRotation(rotation);
    }

    return this;
  }

  public setScale(x: number, y: number): Transform {
    this.world.requireComponent(this[ENTITY], Transform2D).scale.set(x, y);
    return this;
  }

  public translate(dx: number, dy: number): Transform {
    const position: Vec2 = this.world.requireComponent(
      this[ENTITY],
      Transform2D,
    ).position;

    return this.setPosition(position.x + dx, position.y + dy);
  }

  public rotate(angle: number): Transform {
    return this.setRotation(
      this.world.requireComponent(this[ENTITY], Transform2D).rotation + angle,
    );
  }

  public setParent(
    parent: Transform | null,
    worldPositionStays: boolean = true,
  ): Transform {
    const entity: Entity = this[ENTITY];

    if (!worldPositionStays) {
      this.world.setParent(entity, parent !== null ? entityOf(parent) : null);
      return this;
    }

    const currentWorld: Mat3 = worldMatrix(this.world, entity);

    this.world.setParent(entity, parent !== null ? entityOf(parent) : null);

    const parentWorld: Mat3 | null =
      parent !== null ? worldMatrix(this.world, entityOf(parent)) : null;

    const localMatrix: Mat3 =
      parentWorld !== null
        ? parentWorld.invert().multiply(currentWorld)
        : currentWorld;

    const transform: Transform2D = this.world.requireComponent(
      entity,
      Transform2D,
    );
    const position: Vec2 = localMatrix.getTranslation();
    const scale: Vec2 = localMatrix.getScale();

    transform.position.set(position.x, position.y);
    transform.rotation = localMatrix.getRotation();
    transform.scale.set(scale.x, scale.y);

    return this;
  }

  public getChildren(): Transform[] {
    const entity: Entity = this[ENTITY];
    const children: ReadonlyArray<Entity> = this.world.getChildren(entity);
    const result: Transform[] = [];

    for (let i: number = 0; i < children.length; i++) {
      if (this.world.hasComponent(children[i], Transform2D)) {
        result.push(new TransformHandle(this.world, children[i]));
      }
    }

    return result;
  }
}

function createTransform(world: NexusWorld, entity: Entity): Transform {
  return new TransformHandle(world, entity);
}

export const Transform = defineScriptComponent(Transform2D, createTransform);
