import { Entity, NexusWorld, Unsubscribe } from "@atlasjs/nexus";

import { RigidBody2D, Transform2D } from "../../components";

import { RigidBody2DHandle } from "./RigidBody2DHandle";
import { Transform2DHandle } from "./Transform2DHandle";

export class EntityScriptHandles {
  public readonly transform: Transform2DHandle;
  public readonly rigidbody: RigidBody2DHandle;

  public constructor(world: NexusWorld, entity: Entity) {
    this.transform = new Transform2DHandle(world, entity);
    this.rigidbody = new RigidBody2DHandle(world, entity);
  }
}

export class ScriptHandleRegistry {
  private readonly world: NexusWorld;
  private readonly handles: Map<Entity, EntityScriptHandles>;
  private readonly unsubscribers: Unsubscribe[];

  public constructor(world: NexusWorld) {
    this.world = world;
    this.handles = new Map();
    this.unsubscribers = [
      world.onRemove(Transform2D, (entity: Entity) => {
        this.handles.get(entity)?.transform.invalidate();
      }),
      world.onRemove(RigidBody2D, (entity: Entity) => {
        this.handles.get(entity)?.rigidbody.invalidate();
      }),
    ];
  }

  public for(entity: Entity): EntityScriptHandles {
    let handles: EntityScriptHandles | undefined = this.handles.get(entity);

    if (handles === undefined) {
      handles = new EntityScriptHandles(this.world, entity);
      this.handles.set(entity, handles);
    }

    return handles;
  }

  public release(entity: Entity): void {
    this.handles.delete(entity);
  }

  public dispose(): void {
    for (const off of this.unsubscribers) {
      off();
    }

    this.unsubscribers.length = 0;
    this.handles.clear();
  }
}
