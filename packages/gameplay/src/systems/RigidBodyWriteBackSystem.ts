import { Vec2 } from "@atlasjs/math";
import { RigidBody } from "@atlasjs/inertia";

import { RigidBody2D, Transform2D } from "../components";

import { NexusSystem, NexusSystemContext, SparseSet } from "@atlasjs/nexus";

export class RigidBodyWriteBackSystem implements NexusSystem {
  private readonly runtimeBodies: SparseSet<RigidBody>;

  public constructor(runtimeBodies: SparseSet<RigidBody>) {
    this.runtimeBodies = runtimeBodies;
  }

  public update({ world }: NexusSystemContext): void {
    world.query(RigidBody2D, Transform2D).each((entity, _rigidBody2D, transform) => {
      const runtime: RigidBody = this.runtimeBodies.require(entity);

      const translation: Vec2 = runtime.getTranslation();
      const rotation: number = runtime.getRotation();

      transform.position.copyFrom(translation);
      transform.rotation = rotation;
    });
  }
}
