import { ServiceRegistry } from "@atlasjs/core";
import { Component, Entity, NexusWorld } from "@atlasjs/nexus";

import { INSTANTIATOR } from "../../tokens";

import type { InstantiateArgs, Prefab } from "../core";

import type {
  Countdown,
  Repeater,
  Stopwatch,
  TimerHandle,
} from "../timers/types";

import { TimerBag } from "../timers/TimerBag";

import {
  GameEntity,
  ScriptComponentToken,
  ScriptContext,
  ScriptResolver,
  ScriptServiceCtor,
  createGameEntity,
} from "../core";

// prettier-ignore
export class RuntimeScriptContext implements ScriptContext {
  private readonly entity: Entity;
  private readonly world: NexusWorld;
  private readonly services: ServiceRegistry;
  private readonly scripts: ScriptResolver;
  private readonly self: GameEntity;
  private readonly bag: TimerBag = new TimerBag();

  public constructor(entity: Entity, world: NexusWorld, services: ServiceRegistry, scripts: ScriptResolver) {
    this.entity = entity;
    this.world = world;
    this.services = services;
    this.scripts = scripts;
    this.self = createGameEntity(entity, world, scripts);
  }

  public getEntityId(): Entity {
    return this.entity;
  }

  public getEntity(entity: Entity): GameEntity {
    return createGameEntity(entity, this.world, this.scripts);
  }

  public getService<TFacade, TService>(type: ScriptServiceCtor<TFacade, TService>): TFacade {
    return new type(this.services);
  }

  public hasComponent(type: Component<object, any[]> | ScriptComponentToken<unknown, object, any[]>): boolean {
    return this.self.hasComponent(type);
  }

  public getComponent<TApi, TEngine extends object>(type: ScriptComponentToken<TApi, TEngine, any[]>): TApi | undefined;
  public getComponent<TComponent extends object>(type: Component<TComponent, any[]>): TComponent | undefined;
  public getComponent(type: Component<object, any[]> | ScriptComponentToken<unknown, object, any[]>): unknown {
    return this.self.getComponent(type as Component<object, any[]>);
  }

  public addComponent<TApi, TEngine extends object, TArgs extends unknown[]>(type: ScriptComponentToken<TApi, TEngine, TArgs>, ...args: TArgs): TApi;
  public addComponent<TComponent extends object, TArgs extends unknown[]>(type: Component<TComponent, TArgs>, ...args: TArgs): TComponent;
  public addComponent(type: Component<object, any[]> | ScriptComponentToken<unknown, object, any[]>, ...args: any[]): unknown {
    return this.self.addComponent(type as Component<object, any[]>, ...args);
  }

  public removeComponent(type: Component<object, any[]> | ScriptComponentToken<unknown, object, any[]>): void {
    this.self.removeComponent(type);
  }

  public instantiate<TParams>(prefab: Prefab<TParams>, ...rest: InstantiateArgs<TParams>): GameEntity {
    return this.services.get(INSTANTIATOR).instantiate(prefab, ...rest);
  }

  public destroy(): void {
    this.self.destroy();
  }

  public stopwatch(): Stopwatch {
    return this.bag.stopwatch();
  }

  public countdown(seconds: number): Countdown {
    return this.bag.countdown(seconds);
  }

  public every(seconds: number, callback: () => void): Repeater {
    return this.bag.every(seconds, callback);
  }

  public cancel(handle: TimerHandle): void {
    this.bag.cancel(handle);
  }

  public advanceTimers(dt: number): void {
    this.bag.advance(dt);
  }
}
