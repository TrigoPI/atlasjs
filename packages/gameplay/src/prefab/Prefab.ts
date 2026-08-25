import type { EntityBuilder, Prefab } from "../scripting/core";

export type { Prefab } from "../scripting/core";

export function definePrefab<TParams = void>(def: {
  name?: string;
  build(entity: EntityBuilder, params: TParams): void;
}): Prefab<TParams> {
  return def;
}
