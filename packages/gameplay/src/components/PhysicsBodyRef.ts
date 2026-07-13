import { RigidBody } from "@atlasjs/inertia";

export class PhysicsBodyRef {
  public body: RigidBody;

  public constructor(body: RigidBody) {
    this.body = body;
  }
}
