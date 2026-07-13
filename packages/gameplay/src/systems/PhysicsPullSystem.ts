import { RigidBody } from "@atlasjs/inertia";
import { NexusSystem, NexusSystemContext } from "@atlasjs/nexus";

import { PhysicsBodyRef, RigidBody2D, Transform2D } from "../components";

export class PhysicsPullSystem implements NexusSystem {
  // prettier-ignore
  public update({ world }: NexusSystemContext): void {
    world.query(RigidBody2D, Transform2D, PhysicsBodyRef).each((entity, rigidBody, transform, ref) => {
      const body: RigidBody = ref.body;

      transform.position.copyFrom(body.getTranslation());
      transform.rotation = body.getRotation();

      rigidBody.velocity.copyFrom(body.getLinearVelocity());
      rigidBody.angularVelocity = body.getAngularVelocity();
    });
  }
}
