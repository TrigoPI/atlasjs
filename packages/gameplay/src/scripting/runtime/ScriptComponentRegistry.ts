import { Entity, NexusWorld, Unsubscribe } from "@atlasjs/nexus";

import { RigidBody2D, Transform2D } from "../../components";

import { RigidBody2DComponent } from "./RigidBody2DComponent";
import { Transform2DComponent } from "./Transform2DComponent";

export class EntityScriptComponents {
  public readonly transform: Transform2DComponent;
  public readonly rigidbody: RigidBody2DComponent;

  public constructor(world: NexusWorld, entity: Entity) {
    this.transform = new Transform2DComponent(world, entity);
    this.rigidbody = new RigidBody2DComponent(world, entity);
  }
}

export class ScriptComponentRegistry {
  private readonly world: NexusWorld;
  private readonly components: Map<Entity, EntityScriptComponents>;
  private readonly unsubscribers: Unsubscribe[];

  public constructor(world: NexusWorld) {
    this.world = world;
    this.components = new Map();
    this.unsubscribers = [
      world.onRemove(Transform2D, (entity: Entity) => {
        this.components.get(entity)?.transform.invalidate();
      }),
      world.onRemove(RigidBody2D, (entity: Entity) => {
        this.components.get(entity)?.rigidbody.invalidate();
      }),
    ];
  }

  public for(entity: Entity): EntityScriptComponents {
    let components: EntityScriptComponents | undefined = this.components.get(entity);

    if (components === undefined) {
      components = new EntityScriptComponents(this.world, entity);
      this.components.set(entity, components);
    }

    return components;
  }

  public release(entity: Entity): void {
    this.components.delete(entity);
  }

  public dispose(): void {
    for (const off of this.unsubscribers) {
      off();
    }

    this.unsubscribers.length = 0;
    this.components.clear();
  }
}
