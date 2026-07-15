import { Component, Entity } from "@atlasjs/nexus";

import { ScriptComponentCtor } from "./ScriptComponent";
import { ScriptServiceCtor } from "./ScriptService";

export interface ScriptContext {
  getEntityId(): Entity;

  getService<TFacade, TService>(
    type: ScriptServiceCtor<TFacade, TService>,
  ): TFacade;

  hasComponent<TComponent extends object>(
    type: Component<TComponent, any[]>,
  ): boolean;

  getComponent<TComponent extends object>(
    type: Component<TComponent, any[]>,
  ): TComponent | undefined;

  addComponent<TFacade, TEngine extends object, TArgs extends unknown[]>(
    type: ScriptComponentCtor<TFacade, TEngine, TArgs>,
    ...args: TArgs
  ): TFacade;
  addComponent<TComponent extends object, TArgs extends unknown[]>(
    type: Component<TComponent, TArgs>,
    ...args: TArgs
  ): TComponent;

  removeComponent<TComponent extends object>(
    type: Component<TComponent, any[]>,
  ): void;
}
