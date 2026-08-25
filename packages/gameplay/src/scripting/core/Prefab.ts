import type { Entity } from "@atlasjs/nexus";

import type { EntityBuilder } from "./EntityBuilder";

export type Prefab<TParams = void> = {
  readonly name?: string;
  build(entity: EntityBuilder, params: TParams): void;
};

export type InstantiateOptions = { parent?: Entity };

export type InstantiateArgs<TParams> = [TParams] extends [void]
  ? [params?: undefined, options?: InstantiateOptions]
  : [params: TParams, options?: InstantiateOptions];
