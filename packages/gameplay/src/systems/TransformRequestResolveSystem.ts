import { PhysicsBodyRef, RigidBody2D, Transform2D, TransformWriteRequest } from "../components";
import {
  Entity,
  NexusSystem,
  NexusSystemContext,
  NexusWorld,
} from "@atlasjs/nexus";

export class TransformRequestResolveSystem implements NexusSystem {
  //prettier-ignore
  public update({ world }: NexusSystemContext): void {
    world.query(TransformWriteRequest, Transform2D).each((entity, request, transform) => {
      const ref: PhysicsBodyRef | undefined = world.getComponent(entity, PhysicsBodyRef);

      if (this.hasPhysicsControl(world, entity, ref)) {
        if (request.hasPosition) {
          ref.body.setTranslation(request.position.x, request.position.y);
        }

        if (request.hasRotation) {
          ref.body.setRotation(request.rotation);
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
    });
  }

  private hasPhysicsControl(
    world: NexusWorld,
    entity: Entity,
    ref: PhysicsBodyRef | undefined,
  ): ref is PhysicsBodyRef {
    return world.hasComponent(entity, RigidBody2D) && ref != null;
  }
}
