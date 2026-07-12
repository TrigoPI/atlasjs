import { Vec2 } from "@atlasjs/math";
import { RigidBodyType } from "@atlasjs/inertia";

export class RigidBody2D {
  public mass: number;
  public type: RigidBodyType;
  public rotation: number;

  public velocity: Vec2;
  public angularVelocity: number;

  public constructor() {
    this.mass = 1;
    this.rotation = 0;
    this.velocity = new Vec2(0, 0);
    this.angularVelocity = 0;
    this.type = "dynamic";
  }
}
