import { Component, Entity } from "../nexus-types";
import { Query } from "./Query";

export class EmptyQuery<T extends unknown[] = unknown[]> implements Query<T> {
  public get size(): number {
    return 0;
  }

  public has(entity: Entity): boolean {
    return false;
  }

  public getEntities(): Entity[] {
    return [];
  }

  public each(fn: (entity: Entity, ...components: T) => void): void {}

  public *entities(): IterableIterator<Entity> {}

  public *[Symbol.iterator](): IterableIterator<[Entity, ...T]> {}

  public without(...types: Component<any, any[]>[]): Query<T> {
    return this;
  }

  public optional<U extends object[]>(
    ...types: { [K in keyof U]: Component<U[K], any[]> }
  ): Query<[...T, ...{ [K in keyof U]: U[K] | undefined }]> {
    return new EmptyQuery<[...T, ...{ [K in keyof U]: U[K] | undefined }]>();
  }
}
