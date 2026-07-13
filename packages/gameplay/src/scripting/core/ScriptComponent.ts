import { Component, Entity, NexusWorld } from "@atlasjs/nexus";

export interface ScriptComponentCtor<
  TFacade,
  TEngine extends object,
  TArgs extends unknown[],
> {
  new (world: NexusWorld, entity: Entity): TFacade;
  readonly engine: Component<TEngine, TArgs>;
}

export abstract class ScriptComponent<TEngine extends object> {
  protected readonly world: NexusWorld;
  protected readonly entity: Entity;

  public constructor(world: NexusWorld, entity: Entity) {
    const ctor: ScriptComponentCtor<this, TEngine, unknown[]> = this
      .constructor as unknown as ScriptComponentCtor<this, TEngine, unknown[]>;

    if (ctor.engine === undefined) {
      throw new Error(
        `[ScriptComponent] "${ctor.name}" must declare a static "engine" backing component.`,
      );
    }

    this.world = world;
    this.entity = entity;
  }

  protected resolve(): TEngine {
    const ctor: ScriptComponentCtor<this, TEngine, unknown[]> = this
      .constructor as unknown as ScriptComponentCtor<this, TEngine, unknown[]>;
    return this.world.requireComponent(this.entity, ctor.engine);
  }
}
