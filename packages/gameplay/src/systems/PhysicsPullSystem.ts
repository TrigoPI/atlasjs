import { RigidBody } from "@atlasjs/inertia";
import { Entity, NexusSystem, NexusSystemContext } from "@atlasjs/nexus";

import { PhysicsBodyRef, RigidBody2D, Transform2D } from "../components";

export class PhysicsPullSystem implements NexusSystem {
  // prettier-ignore
  public update({ world }: NexusSystemContext): void {
    world.query(RigidBody2D, Transform2D, PhysicsBodyRef).each((_: Entity, rigidBody: RigidBody2D, transform: Transform2D, ref: PhysicsBodyRef) => {
      if (rigidBody.type !== "dynamic") {
        return;
      }

      const body: RigidBody = ref.body;

      transform.position.copyFrom(body.getTranslation());
      transform.rotation = body.getRotation();

      rigidBody.velocity.copyFrom(body.getLinearVelocity());
      rigidBody.angularVelocity = body.getAngularVelocity();
    });
  }
}
