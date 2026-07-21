import { ServiceRegistry } from "@atlasjs/core";
import { Component, Entity, NexusWorld } from "@atlasjs/nexus";

import {
  ScriptComponentToken,
  ScriptContext,
  ScriptServiceCtor,
  isScriptComponentToken,
} from "../core";

// prettier-ignore
export class RuntimeScriptContext implements ScriptContext {
  private readonly entity: Entity;
  private readonly world: NexusWorld;
  private readonly services: ServiceRegistry;

  public constructor(entity: Entity, world: NexusWorld, services: ServiceRegistry) {
    this.entity = entity;
    this.world = world;
    this.services = services;
  }

  public getEntityId(): Entity {
    return this.entity;
  }

  public getService<TFacade, TService>(
    type: ScriptServiceCtor<TFacade, TService>,
  ): TFacade {
    return new type(this.services);
  }

  public hasComponent(
    type: Component<object, any[]> | ScriptComponentToken<unknown, object, any[]>,
  ): boolean {
    return this.world.hasComponent(
      this.entity,
      isScriptComponentToken(type) ? type.engine : type,
    );
  }

  public getComponent<TApi, TEngine extends object>(type: ScriptComponentToken<TApi, TEngine, any[]>): TApi | undefined;
  public getComponent<TComponent extends object>(type: Component<TComponent, any[]>): TComponent | undefined;
  public getComponent(type: Component<object, any[]> | ScriptComponentToken<unknown, object, any[]>): unknown {
    if (isScriptComponentToken(type)) {
      if (!this.world.hasComponent(this.entity, type.engine)) {
        return undefined;
      }
      return type.create(this.world, this.entity);
    }

    return this.world.getComponent(this.entity, type);
  }

  public addComponent<TApi, TEngine extends object, TArgs extends unknown[]>(type: ScriptComponentToken<TApi, TEngine, TArgs>, ...args: TArgs): TApi;
  public addComponent<TComponent extends object, TArgs extends unknown[]>(type: Component<TComponent, TArgs>, ...args: TArgs): TComponent;
  public addComponent(type: Component<object, any[]> | ScriptComponentToken<unknown, object, any[]>, ...args: any[]): unknown {
    if (isScriptComponentToken(type)) {
      if (!this.world.hasComponent(this.entity, type.engine)) {
        this.world.addComponent(this.entity, type.engine, ...args);
      }
      return type.create(this.world, this.entity);
    }

    const existing: object | undefined = this.world.getComponent(this.entity, type);
    if (existing !== undefined) {
      return existing;
    }

    return this.world.addComponent(this.entity, type, ...args);
  }

  public removeComponent(
    type: Component<object, any[]> | ScriptComponentToken<unknown, object, any[]>,
  ): void {
    this.world.removeComponent(
      this.entity,
      isScriptComponentToken(type) ? type.engine : type,
    );
  }
}
