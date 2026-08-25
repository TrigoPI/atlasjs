import { Component, Entity, NexusWorld } from "@atlasjs/nexus";

import { createGameEntity } from "../scripting/core";
import type { ScriptManager } from "../scripting/runtime";

import type {
  AtlasScript,
  AttachArgs,
  EntityBuilder,
  GameEntity,
  ScriptComponentToken,
  ScriptConstructor,
} from "../scripting/core";

// prettier-ignore
export class PrefabEntityBuilder implements EntityBuilder {
  public readonly entity: Entity;
  private readonly self: GameEntity;
  private readonly world: NexusWorld;
  private readonly scripts: ScriptManager;

  public constructor(entity: Entity, world: NexusWorld, scripts: ScriptManager) {
    this.entity = entity;
    this.self = createGameEntity(entity, world, scripts);
    this.world = world;
    this.scripts = scripts;
  }

  public add<TApi, TEngine extends object, TArgs extends unknown[]>(type: ScriptComponentToken<TApi, TEngine, TArgs>, ...args: TArgs): TApi;
  public add<TComponent extends object, TArgs extends unknown[]>(type: Component<TComponent, TArgs>, ...args: TArgs): TComponent;
  public add(type: Component<object, any[]> | ScriptComponentToken<unknown, object, any[]>, ...args: any[]): unknown {
    return this.self.addComponent(type as Component<object, any[]>, ...args);
  }

  public attach<TScript extends AtlasScript>(Script: ScriptConstructor<TScript>, ...rest: AttachArgs<TScript>): TScript {
    return this.scripts.attach(this.entity, Script, ...rest);
  }

  public child(build: (entity: EntityBuilder) => void): EntityBuilder {
    const childEntity: Entity = this.world.createEntity();
    const childBuilder: PrefabEntityBuilder = new PrefabEntityBuilder(childEntity, this.world, this.scripts);
    this.world.setParent(childEntity, this.entity);
    build(childBuilder);
    return childBuilder;
  }
}
