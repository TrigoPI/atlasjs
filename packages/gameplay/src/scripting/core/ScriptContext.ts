import { Entity } from "@atlasjs/nexus";

import type { GameEntity } from "./GameEntity";
import { ComponentAccess } from "./ComponentAccess";
import { ScriptServiceCtor } from "./ScriptService";
import type { Prefab } from "../../prefab/Prefab";
import type { InstantiateArgs } from "../../prefab/Instantiator";

// prettier-ignore
export interface ScriptContext extends ComponentAccess {
  getEntityId(): Entity;

  getEntity(entity: Entity): GameEntity;

  getService<TFacade, TService>(type: ScriptServiceCtor<TFacade, TService>): TFacade;

  instantiate<TParams>(prefab: Prefab<TParams>, ...rest: InstantiateArgs<TParams>): GameEntity;
  destroy(): void;
}
