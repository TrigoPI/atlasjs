import { PhysicsWorld, RigidBody } from "@atlasjs/inertia";
import { Entity, NexusSystem, NexusSystemContext } from "@atlasjs/nexus";

import { PhysicsBodyRef, RigidBody2D, Transform2D } from "../components";

export class PhysicsPushSystem implements NexusSystem {
  private readonly inertia: PhysicsWorld;
  private readonly pending: Entity[];

  public constructor(inertia: PhysicsWorld) {
    this.inertia = inertia;
    this.pending = [];
  }

  // prettier-ignore
  public update({ world }: NexusSystemContext): void {
    world.query(RigidBody2D, Transform2D).without(PhysicsBodyRef).each((entity) => {
      this.pending.push(entity);
    });

    for (const entity of this.pending) {
      const rigidBody: RigidBody2D = world.requireComponent(entity, RigidBody2D);
      const transform: Transform2D = world.requireComponent(entity, Transform2D);
      const body: RigidBody = this.inertia.createRigidBody({
        type: rigidBody.type,
        translation: transform.position,
        rotation: transform.rotation,
        linearVelocity: rigidBody.velocity,
        angularVelocity: rigidBody.angularVelocity,
      });

      world.addComponent(entity, PhysicsBodyRef, body);
    }

    this.pending.length = 0;

    world.query(RigidBody2D, Transform2D, PhysicsBodyRef).each((_, rigidBody, transform, ref) => {
      const body: RigidBody = ref.body;

      body.setMass(rigidBody.mass);
      body.setLinearVelocity(rigidBody.velocity.x, rigidBody.velocity.y);
      body.setAngularVelocity(rigidBody.angularVelocity);

      if (rigidBody.type === "kinematic" || rigidBody.type === "static") {
        body.setTranslation(transform.position.x, transform.position.y);
        body.setRotation(transform.rotation);
      }
    });
  }
}
