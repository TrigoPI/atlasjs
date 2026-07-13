import { Component, Entity } from "../types";

export interface Query<T extends unknown[] = unknown[]> {
  readonly size: number;
  has(entity: Entity): boolean;
  getEntities(): Entity[];
  entities(): IterableIterator<Entity>;
  each(fn: (entity: Entity, ...components: T) => void): void;
  [Symbol.iterator](): IterableIterator<[Entity, ...T]>;
  without(...types: Component<any, any[]>[]): Query<T>;
  optional<U extends object[]>(
    ...types: { [K in keyof U]: Component<U[K], any[]> }
  ): Query<[...T, ...{ [K in keyof U]: U[K] | undefined }]>;
}
