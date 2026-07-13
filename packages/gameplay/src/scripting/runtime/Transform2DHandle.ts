import { Vec2 } from "@atlasjs/math";
import { Entity, NexusWorld } from "@atlasjs/nexus";

import {
  PhysicsBodyRef,
  RigidBody2D,
  Transform2D,
} from "../../components";

export class Transform2DHandle {
  private readonly world: NexusWorld;
  private readonly entity: Entity;
  private cached: Transform2D | null;

  public constructor(world: NexusWorld, entity: Entity) {
    this.world = world;
    this.entity = entity;
    this.cached = null;
  }

  public invalidate(): void {
    this.cached = null;
  }

  public get position(): Vec2 {
    return this.resolve().position;
  }

  public set position(value: Vec2) {
    this.setPosition(value.x, value.y);
  }

  public get rotation(): number {
    return this.resolve().rotation;
  }

  public set rotation(value: number) {
    this.setRotation(value);
  }

  public get scale(): Vec2 {
    return this.resolve().scale;
  }

  public set scale(value: Vec2) {
    this.setScale(value.x, value.y);
  }

  public setPosition(x: number, y: number): this {
    this.resolve().position.set(x, y);

    const body: PhysicsBodyRef | undefined = this.controllingBody();
    if (body !== undefined) {
      body.body.setTranslation(x, y);
    }

    return this;
  }

  public setRotation(rotation: number): this {
    this.resolve().rotation = rotation;

    const body: PhysicsBodyRef | undefined = this.controllingBody();
    if (body !== undefined) {
      body.body.setRotation(rotation);
    }

    return this;
  }

  public setScale(x: number, y: number): this {
    this.resolve().scale.set(x, y);
    return this;
  }

  public translate(dx: number, dy: number): this {
    const position: Vec2 = this.resolve().position;
    return this.setPosition(position.x + dx, position.y + dy);
  }

  public rotate(angle: number): this {
    return this.setRotation(this.resolve().rotation + angle);
  }

  private resolve(): Transform2D {
    if (this.cached === null) {
      this.cached = this.world.requireComponent(this.entity, Transform2D);
    }

    return this.cached;
  }

  private controllingBody(): PhysicsBodyRef | undefined {
    const rigidBody: RigidBody2D | undefined = this.world.getComponent(
      this.entity,
      RigidBody2D,
    );

    if (rigidBody === undefined || rigidBody.type !== "dynamic") {
      return undefined;
    }

    return this.world.getComponent(this.entity, PhysicsBodyRef);
  }
}
