import { Component, Entity, NexusWorld } from "@atlasjs/nexus";

import { ScriptComponentCtor, ScriptContext } from "../core";

import { RigidBody2DComponent, Transform2DComponent } from "../components";

import {
  EntityScriptComponents,
  ScriptComponentRegistry,
} from "./ScriptComponentRegistry";

// prettier-ignore
export class RuntimeScriptContext implements ScriptContext {
  private readonly entity: Entity;
  private readonly world: NexusWorld;
  private readonly components: EntityScriptComponents;

  public constructor(
    entity: Entity,
    world: NexusWorld,
    registry: ScriptComponentRegistry,
  ) {
    this.entity = entity;
    this.world = world;
    this.components = registry.for(entity);
  }

  public getEntityId(): Entity {
    return this.entity;
  }

  public get transform(): Transform2DComponent {
    return this.components.transform;
  }

  public get rigidbody(): RigidBody2DComponent {
    return this.components.rigidbody;
  }

  public hasComponent<TComponent extends object>(
    type: Component<TComponent, any[]>,
  ): boolean {
    if (this.isFacade(type)) {
      return this.world.hasComponent(this.entity, type.engine);
    }

    return this.world.hasComponent(this.entity, type);
  }

  public getComponent<TComponent extends object>(
    type: Component<TComponent, any[]>,
  ): TComponent | undefined {
    if (this.isFacade(type)) {
      if (!this.world.hasComponent(this.entity, type.engine)) {
        return undefined;
      }

      return new type(this.world, this.entity);
    }

    return this.world.getComponent(this.entity, type);
  }

  public addComponent<TComponent extends object, TArgs extends unknown[]>(type: Component<TComponent, TArgs>, ...args: TArgs): TComponent;
  public addComponent<TFacade, TEngine extends object, TArgs extends unknown[]>(type: ScriptComponentCtor<TFacade, TEngine, TArgs>, ...args: TArgs): TFacade;
  public addComponent<TComponent extends object, TArgs extends unknown[]>(type: Component<TComponent, TArgs> | ScriptComponentCtor<TComponent, object, TArgs>, ...args: TArgs): TComponent {
    if (this.isFacade(type)) {
      if (!this.world.hasComponent(this.entity, type.engine)) {
        this.world.addComponent(this.entity, type.engine, ...args);
      }

      return new type(this.world, this.entity);
    }

    const existing: TComponent | undefined = this.world.getComponent(
      this.entity,
      type,
    );

    if (existing !== undefined) {
      return existing;
    }

    return this.world.addComponent(this.entity, type, ...args);
  }

  public removeComponent<TComponent extends object>(
    type: Component<TComponent, any[]>,
  ): void {
    if (this.isFacade(type)) {
      this.world.removeComponent(this.entity, type.engine);
      return;
    }

    this.world.removeComponent(this.entity, type);
  }

  private isFacade<TComponent extends object, TArgs extends unknown[]>(
    type:Component<TComponent, TArgs> | ScriptComponentCtor<TComponent, object, TArgs>,
  ): type is ScriptComponentCtor<TComponent, object, TArgs> {
    return "engine" in type;
  }
}
