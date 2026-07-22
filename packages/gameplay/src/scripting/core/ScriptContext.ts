import { Component, Entity } from "@atlasjs/nexus";

import type { GameEntity } from "./GameEntity";
import { ScriptComponentToken } from "./ScriptComponentToken";
import { ScriptServiceCtor } from "./ScriptService";

// prettier-ignore
export interface ScriptContext {
  getEntityId(): Entity;

  getEntity(entity: Entity): GameEntity;

  getService<TFacade, TService>(type: ScriptServiceCtor<TFacade, TService>): TFacade;
  hasComponent(type: | Component<object, any[]> | ScriptComponentToken<unknown, object, any[]>): boolean;

  getComponent<TApi, TEngine extends object>(type: ScriptComponentToken<TApi, TEngine, any[]>): TApi | undefined;
  getComponent<TComponent extends object>(type: Component<TComponent, any[]>): TComponent | undefined;

  addComponent<TApi, TEngine extends object, TArgs extends unknown[]>(type: ScriptComponentToken<TApi, TEngine, TArgs>, ...args: TArgs): TApi;
  addComponent<TComponent extends object, TArgs extends unknown[]>(type: Component<TComponent, TArgs>, ...args: TArgs): TComponent;

  removeComponent(type: | Component<object, any[]> | ScriptComponentToken<unknown, object, any[]>): void;
}
