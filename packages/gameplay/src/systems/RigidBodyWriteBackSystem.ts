import { Vec2 } from "@atlasjs/math";
import { RigidBody } from "@atlasjs/inertia";

import { RigidBody2D, Transform2D } from "../components";

import {
  NexusSystem,
  NexusSystemContext,
  Query,
  SparseSet,
} from "@atlasjs/nexus";

export class RigidBodyWriteBackSystem implements NexusSystem {
  private readonly runtimeBodies: SparseSet<RigidBody>;

  public constructor(runtimeBodies: SparseSet<RigidBody>) {
    this.runtimeBodies = runtimeBodies;
  }

  // prettier-ignore
  public update({ world }: NexusSystemContext): void {
    const query: Query = world.query(RigidBody2D, Transform2D);

    for (const entity of query.entities()) {
      const runtime: RigidBody = this.runtimeBodies.require(entity);
      const transform: Transform2D = world.requireComponent(entity, Transform2D,);

      const translation: Vec2 = runtime.getTranslation();
      const rotation: number = runtime.getRotation();

      transform.position.copyFrom(translation);
      transform.rotation = rotation;
    }
  }
}
