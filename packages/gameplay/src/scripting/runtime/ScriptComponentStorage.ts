import { Entity } from "@atlasjs/nexus";
import { ScriptComponentConstructor } from "../core";

export class ScriptComponentStorage {
  private readonly storages: Map<
    ScriptComponentConstructor,
    Map<Entity, object>
  >;

  public constructor() {
    this.storages = new Map();
  }

  public has<TComponent extends object>(
    entityId: Entity,
    type: ScriptComponentConstructor<TComponent>,
  ): boolean {
    const storage: Map<Entity, object> | undefined = this.storages.get(type);
    return storage?.has(entityId) ?? false;
  }

  public get<TComponent extends object>(
    entityId: Entity,
    type: ScriptComponentConstructor<TComponent>,
  ): TComponent | null {
    const storage: Map<Entity, object> | undefined = this.storages.get(type);

    if (!storage) {
      return null;
    }

    return (storage.get(entityId) as TComponent | undefined) ?? null;
  }

  public add<TComponent extends object, TArgs extends unknown[]>(
    entityId: Entity,
    type: ScriptComponentConstructor<TComponent, TArgs>,
    ...args: TArgs
  ): TComponent {
    let storage: Map<Entity, object> | undefined = this.storages.get(type);

    if (!storage) {
      storage = new Map<Entity, object>();
      this.storages.set(type, storage);
    }

    const instance: TComponent = new type(...args);
    storage.set(entityId, instance);

    return instance;
  }

  public set<TComponent extends object>(
    entityId: Entity,
    type: ScriptComponentConstructor<TComponent>,
    instance: TComponent,
  ): void {
    let storage = this.storages.get(type);

    if (!storage) {
      storage = new Map<Entity, object>();
      this.storages.set(type, storage);
    }

    storage.set(entityId, instance);
  }

  public remove<TComponent extends object>(
    entityId: Entity,
    type: ScriptComponentConstructor<TComponent>,
  ): void {
    const storage: Map<Entity, object> | undefined = this.storages.get(type);

    if (!storage) {
      return;
    }

    storage.delete(entityId);

    if (storage.size === 0) {
      this.storages.delete(type);
    }
  }

  public removeAllByEntity(entityId: Entity): void {
    for (const [type, storage] of this.storages) {
      storage.delete(entityId);

      if (storage.size === 0) {
        this.storages.delete(type);
      }
    }
  }

  public getEntitiesWith<TComponent extends object>(
    type: ScriptComponentConstructor<TComponent>,
  ): readonly Entity[] {
    const storage: Map<Entity, object> | undefined = this.storages.get(type);

    if (!storage) {
      return [];
    }

    return Array.from(storage.keys());
  }

  public entries<TComponent extends object>(
    type: ScriptComponentConstructor<TComponent>,
  ): readonly [Entity, TComponent][] {
    const storage: Map<Entity, object> | undefined = this.storages.get(type);

    if (!storage) {
      return [];
    }

    return Array.from(storage.entries()) as [Entity, TComponent][];
  }
}
