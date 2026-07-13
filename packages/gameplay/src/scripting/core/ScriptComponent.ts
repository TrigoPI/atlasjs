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
  private cached: TEngine | null;

  public constructor(world: NexusWorld, entity: Entity) {
    this.world = world;
    this.entity = entity;
    this.cached = null;
  }

  public invalidate(): void {
    this.cached = null;
  }

  protected resolve(): TEngine {
    if (this.cached === null) {
      const ctor: ScriptComponentCtor<this, TEngine, unknown[]> = this
        .constructor as unknown as ScriptComponentCtor<this, TEngine, unknown[]>;
      this.cached = this.world.requireComponent(this.entity, ctor.engine);
    }

    return this.cached;
  }
}
