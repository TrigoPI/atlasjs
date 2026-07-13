import { Vec2 } from "@atlasjs/math";
import { RigidBodyType } from "@atlasjs/inertia";
import { Entity, NexusWorld } from "@atlasjs/nexus";

import { RigidBody2D } from "../../components";

export class RigidBody2DHandle {
  private readonly world: NexusWorld;
  private readonly entity: Entity;
  private cached: RigidBody2D | null;

  public constructor(world: NexusWorld, entity: Entity) {
    this.world = world;
    this.entity = entity;
    this.cached = null;
  }

  public invalidate(): void {
    this.cached = null;
  }

  public get type(): RigidBodyType {
    return this.resolve().type;
  }

  public set type(value: RigidBodyType) {
    this.resolve().type = value;
  }

  public get mass(): number {
    return this.resolve().mass;
  }

  public set mass(value: number) {
    this.resolve().mass = value;
  }

  public get velocity(): Vec2 {
    return this.resolve().velocity;
  }

  public set velocity(value: Vec2) {
    this.resolve().velocity.copyFrom(value);
  }

  public get angularVelocity(): number {
    return this.resolve().angularVelocity;
  }

  public set angularVelocity(value: number) {
    this.resolve().angularVelocity = value;
  }

  public setVelocity(x: number, y: number): this {
    this.resolve().velocity.set(x, y);
    return this;
  }

  public setMass(mass: number): this {
    this.resolve().mass = mass;
    return this;
  }

  public setAngularVelocity(angularVelocity: number): this {
    this.resolve().angularVelocity = angularVelocity;
    return this;
  }

  private resolve(): RigidBody2D {
    if (this.cached === null) {
      this.cached = this.world.requireComponent(this.entity, RigidBody2D);
    }

    return this.cached;
  }
}
