import type { EntityBuilder } from "./EntityBuilder";

export type Prefab<TParams = void> = {
  readonly name?: string;
  build(entity: EntityBuilder, params: TParams): void;
};

export function definePrefab<TParams = void>(def: {
  name?: string;
  build(entity: EntityBuilder, params: TParams): void;
}): Prefab<TParams> {
  return def;
}
