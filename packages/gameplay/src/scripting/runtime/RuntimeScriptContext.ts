import { Entity } from "@atlasjs/nexus";

import { ScriptComponentConstructor, ScriptContext } from "../core";
import { ScriptComponentStorage } from "./ScriptComponentStorage";

export class RuntimeScriptContext implements ScriptContext {
  private readonly entityIdValue: Entity;
  private readonly componentStorage: ScriptComponentStorage;

  public constructor(
    entityIdValue: Entity,
    componentStorage: ScriptComponentStorage,
  ) {
    this.entityIdValue = entityIdValue;
    this.componentStorage = componentStorage;
  }

  public getEntityId(): Entity {
    return this.entityIdValue;
  }

  public hasComponent<TComponent extends object>(
    type: ScriptComponentConstructor<TComponent>,
  ): boolean {
    return this.componentStorage.has(this.entityIdValue, type);
  }

  public getComponent<TComponent extends object>(
    type: ScriptComponentConstructor<TComponent>,
  ): TComponent | null {
    return this.componentStorage.get(this.entityIdValue, type);
  }

  public addComponent<TComponent extends object, TArgs extends unknown[]>(
    type: ScriptComponentConstructor<TComponent, TArgs>,
    ...args: TArgs
  ): TComponent {
    const existing: TComponent | null = this.componentStorage.get(
      this.entityIdValue,
      type,
    );

    if (existing) {
      return existing;
    }

    return this.componentStorage.add(this.entityIdValue, type, ...args);
  }

  public removeComponent<TComponent extends object>(
    type: ScriptComponentConstructor<TComponent>,
  ): void {
    this.componentStorage.remove(this.entityIdValue, type);
  }
}
