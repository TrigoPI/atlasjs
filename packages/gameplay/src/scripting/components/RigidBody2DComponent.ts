import { RigidBodyType } from "@atlasjs/inertia";
import { Vector2D } from "../maths";

export class RigidBody2DComponent {
  public type: RigidBodyType;

  public mass: number;
  public rotation: number;
  public angularVelocity: number;

  public position: Vector2D;
  public velocity: Vector2D;

  public constructor() {
    this.type = "dynamic";
    this.mass = 1;
    this.rotation = 0;
    this.angularVelocity = 0;

    this.position = new Vector2D(0, 0);
    this.velocity = new Vector2D(0, 0);
  }

  public setMass(mass: number): RigidBody2DComponent {
    this.mass = mass;
    return this;
  }

  public setRotation(rotation: number): RigidBody2DComponent {
    this.rotation = rotation;
    return this;
  }

  public setAngularVelocity(angularVelocity: number): RigidBody2DComponent {
    this.angularVelocity = angularVelocity;
    return this;
  }

  public setVelocity(velocity: Vector2D): RigidBody2DComponent {
    this.velocity.copy(velocity);
    return this;
  }
}
