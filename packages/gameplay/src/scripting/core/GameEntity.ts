import { Component, Entity, NexusWorld } from "@atlasjs/nexus";

import type { AtlasScript } from "./AtlasScript";
import type { ScriptConstructor } from "./core-types";
import { ComponentAccess } from "./ComponentAccess";
import {
  type ScriptComponentToken,
  isScriptComponentToken,
} from "./ScriptComponentToken";

// prettier-ignore
export interface GameEntity extends ComponentAccess {
  readonly id: Entity;

  requireComponent<TApi, TEngine extends object>(type: ScriptComponentToken<TApi, TEngine, any[]>): TApi;
  requireComponent<TComponent extends object>(type: Component<TComponent, any[]>): TComponent;

  getScript<T extends AtlasScript>(type: ScriptConstructor<T>): T | undefined;

  destroy(): void;
}

// prettier-ignore
export interface ScriptResolver {
  getScript<T extends AtlasScript>(entityId: Entity, type: ScriptConstructor<T>): T | undefined;
  destroyEntityScripts(entityId: Entity): void;
}

// prettier-ignore
class GameEntityHandle implements GameEntity {
  private readonly world: NexusWorld;
  private readonly entity: Entity;
  private readonly scripts: ScriptResolver;

  public constructor(entity: Entity, world: NexusWorld, scripts: ScriptResolver) {
    this.entity = entity;
    this.world = world;
    this.scripts = scripts;
  }

  public get id(): Entity {
    return this.entity;
  }

  public hasComponent(type: Component<object, any[]> | ScriptComponentToken<unknown, object, any[]>): boolean {
    return this.world.hasComponent(this.entity, isScriptComponentToken(type) ? type.engine : type);
  }

  public getComponent<TApi, TEngine extends object>(type: ScriptComponentToken<TApi, TEngine, any[]>): TApi | undefined;
  public getComponent<TComponent extends object>(type: Component<TComponent, any[]>): TComponent | undefined;
  public getComponent(type: Component<object, any[]> | ScriptComponentToken<unknown, object, any[]>): unknown {
    if (isScriptComponentToken(type)) {
      return this.world.hasComponent(this.entity, type.engine) ? type.create(this.world, this.entity) : undefined;
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
    return existing !== undefined ? existing : this.world.addComponent(this.entity, type, ...args);
  }

  public removeComponent(type: Component<object, any[]> | ScriptComponentToken<unknown, object, any[]>): void {
    this.world.removeComponent(this.entity, isScriptComponentToken(type) ? type.engine : type);
  }

  public requireComponent<TApi, TEngine extends object>(type: ScriptComponentToken<TApi, TEngine, any[]>): TApi;
  public requireComponent<TComponent extends object>(type: Component<TComponent, any[]>): TComponent;
  public requireComponent(type: Component<object, any[]> | ScriptComponentToken<unknown, object, any[]>): unknown {
    const component: unknown = this.getComponent(type as Component<object, any[]>);
    if (component === undefined) {
      const name: string = isScriptComponentToken(type) ? type.engine.name : type.name;
      throw new Error(`[GameEntity] Required component "${name}" is missing on entity "${this.entity}".`);
    }
    return component;
  }

  public getScript<T extends AtlasScript>(type: ScriptConstructor<T>): T | undefined {
    return this.scripts.getScript(this.entity, type);
  }

  public destroy(): void {
    this.destroySubtreeScripts(this.entity);
    this.world.commands.destroy(this.entity);
  }

  private destroySubtreeScripts(entity: Entity): void {
    const children: ReadonlyArray<Entity> = this.world.getChildren(entity);
    for (let i: number = 0; i < children.length; i++) {
      this.destroySubtreeScripts(children[i]);
    }
    this.scripts.destroyEntityScripts(entity);
  }
}

export function createGameEntity(
  entity: Entity,
  world: NexusWorld,
  scripts: ScriptResolver,
): GameEntity {
  return new GameEntityHandle(entity, world, scripts);
}
