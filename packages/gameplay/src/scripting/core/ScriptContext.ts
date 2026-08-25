import { Entity } from "@atlasjs/nexus";

import type { GameEntity } from "./GameEntity";
import { ComponentAccess } from "./ComponentAccess";
import { ScriptServiceCtor } from "./ScriptService";
import type { InstantiateArgs, Prefab } from "./Prefab";

// prettier-ignore
export interface ScriptContext extends ComponentAccess {
  getEntityId(): Entity;

  getEntity(entity: Entity): GameEntity;

  getService<TFacade, TService>(type: ScriptServiceCtor<TFacade, TService>): TFacade;

  instantiate<TParams>(prefab: Prefab<TParams>, ...rest: InstantiateArgs<TParams>): GameEntity;
  destroy(): void;
}
