import { Component, Entity, NexusWorld } from "@atlasjs/nexus";

import { ScriptContext } from "../core";

import { RigidBody2DComponent } from "./RigidBody2DComponent";
import { Transform2DComponent } from "./Transform2DComponent";

import {
  EntityScriptComponents,
  ScriptComponentRegistry,
} from "./ScriptComponentRegistry";

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
    return this.world.hasComponent(this.entity, type);
  }

  public getComponent<TComponent extends object>(
    type: Component<TComponent, any[]>,
  ): TComponent | undefined {
    return this.world.getComponent(this.entity, type);
  }

  public addComponent<TComponent extends object, TArgs extends unknown[]>(
    type: Component<TComponent, TArgs>,
    ...args: TArgs
  ): TComponent {
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
    this.world.removeComponent(this.entity, type);
  }
}
