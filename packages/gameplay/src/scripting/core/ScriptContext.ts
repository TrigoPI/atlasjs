import { Entity } from "@atlasjs/nexus";
import { ScriptComponentConstructor } from "./core-types";

export interface ScriptContext {
  getEntityId(): Entity;

  hasComponent<TComponent extends object>(
    type: ScriptComponentConstructor<TComponent>,
  ): boolean;

  getComponent<TComponent extends object>(
    type: ScriptComponentConstructor<TComponent>,
  ): TComponent | null;

  addComponent<TComponent extends object, TArgs extends unknown[]>(
    type: ScriptComponentConstructor<TComponent, TArgs>,
    ...args: TArgs
  ): TComponent;

  removeComponent<TComponent extends object>(
    type: ScriptComponentConstructor<TComponent>,
  ): void;
}
