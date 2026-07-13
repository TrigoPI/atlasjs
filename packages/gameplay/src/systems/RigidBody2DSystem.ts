import { PhysicsWorld, RigidBody } from "@atlasjs/inertia";
import { createLogger, Logger } from "@atlasjs/utils";

import { RigidBody2D, Transform2D } from "../components";

import { NexusSystem, NexusSystemContext, SparseSet } from "@atlasjs/nexus";

export class RigidBody2DSystem implements NexusSystem {
  private readonly logger: Logger;
  private readonly inertia: PhysicsWorld;
  private readonly runtimeBodies: SparseSet<RigidBody>;

  public constructor(
    inertia: PhysicsWorld,
    runtimeBodies: SparseSet<RigidBody>,
  ) {
    this.logger = createLogger(RigidBody2DSystem.name);

    this.inertia = inertia;
    this.runtimeBodies = runtimeBodies;
  }

  public update({ world }: NexusSystemContext): void {
    world.query(RigidBody2D, Transform2D).each((entity, rigidBody2D, transform2D) => {
      let runtime: RigidBody | undefined = this.runtimeBodies.get(entity);

      if (!runtime) {
        this.logger.log(`Creating new runtime body for entity ${entity}`);
        runtime = this.createRuntimeBody(rigidBody2D, transform2D);
        this.runtimeBodies.set(entity, runtime);
      }

      runtime.setMass(rigidBody2D.mass);
    });
  }

  private createRuntimeBody(
    rigidBody2D: RigidBody2D,
    transform2D: Transform2D,
  ): RigidBody {
    return this.inertia.createRigidBody({
      type: rigidBody2D.type,
      linearVelocity: rigidBody2D.velocity,
      angularVelocity: rigidBody2D.angularVelocity,
      translation: transform2D.position,
      rotation: transform2D.rotation,
    });
  }
}
