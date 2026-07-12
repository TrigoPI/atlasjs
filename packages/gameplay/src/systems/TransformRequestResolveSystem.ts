import { RigidBody } from "@atlasjs/inertia";
import { RigidBody2D, Transform2D, TransformWriteRequest } from "../components";
import {
  Entity,
  NexusSystem,
  NexusSystemContext,
  NexusWorld,
  Query,
  SparseSet,
} from "@atlasjs/nexus";

export class TransformRequestResolveSystem implements NexusSystem {
  private readonly runtimeBodies: SparseSet<RigidBody>;

  public constructor(runtimeBodies: SparseSet<RigidBody>) {
    this.runtimeBodies = runtimeBodies;
  }

  //prettier-ignore
  public update({ world }: NexusSystemContext): void {
    const query: Query = world.query(TransformWriteRequest);

    for (const entity of query.entities()) {
      const [request, transform] = world.requireComponents(entity, TransformWriteRequest, Transform2D);
      const rigidBodyRuntime: RigidBody | undefined = this.runtimeBodies.get(entity);

      if (this.hasPhysicsControl(world, entity, rigidBodyRuntime)) {
        if (request.hasPosition) {
          rigidBodyRuntime.setTranslation(request.position.x, request.position.y);
        }

        if (request.hasRotation) {
          rigidBodyRuntime.setRotation(request.rotation);
        }
      } else {
        if (request.hasPosition) {
          transform.position.copyFrom(request.position);
        }

        if (request.hasRotation) {
          transform.rotation = request.rotation;
        }
      }

      if (request.hasScale) {
        transform.scale.copyFrom(request.scale);
      }
    }
  }

  private hasPhysicsControl(
    world: NexusWorld,
    entity: Entity,
    rigidBodyRuntime: RigidBody | undefined,
  ): rigidBodyRuntime is RigidBody {
    return world.hasComponent(entity, RigidBody2D) && rigidBodyRuntime != null;
  }
}
