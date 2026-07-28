import { Collider } from "@atlasjs/inertia";

export class PhysicsColliderRef {
  public collider: Collider;

  public constructor(collider: Collider) {
    this.collider = collider;
  }
}
