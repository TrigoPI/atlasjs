import { Entity } from "@atlasjs/nexus";
import { ScriptComponentConstructor } from "../core";

export class ScriptComponentRuntimeStorage {
  private readonly storages: Map<
    ScriptComponentConstructor,
    Map<Entity, object>
  >;

  public constructor() {
    this.storages = new Map();
  }

  public get<TState extends object>(
    entityId: Entity,
    type: ScriptComponentConstructor,
  ): TState | null {
    const storage: Map<Entity, object> | undefined = this.storages.get(type);

    if (!storage) {
      return null;
    }

    return (storage.get(entityId) as TState | undefined) ?? null;
  }

  public getOrCreate<TState extends object>(
    entityId: Entity,
    type: ScriptComponentConstructor,
    state: TState,
  ): TState {
    let storage: Map<Entity, object> | undefined = this.storages.get(type);

    if (!storage) {
      storage = new Map<Entity, object>();
      this.storages.set(type, storage);
    }

    // prettier-ignore
    let foundState: TState | undefined = storage.get(entityId) as TState | undefined;

    if (!foundState) {
      foundState = state;
      storage.set(entityId, state);
    }

    return foundState;
  }

  public removeAllByEntity(entityId: Entity): void {
    for (const [type, storage] of this.storages) {
      storage.delete(entityId);

      if (storage.size === 0) {
        this.storages.delete(type);
      }
    }
  }
}
