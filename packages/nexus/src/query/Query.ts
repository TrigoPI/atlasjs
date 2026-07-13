import { Entity } from "../nexus-types";

export interface Query<T extends object[] = object[]> {
  readonly size: number;
  has(entity: Entity): boolean;
  getEntities(): Entity[];
  entities(): IterableIterator<Entity>;
  each(fn: (entity: Entity, ...components: T) => void): void;
  [Symbol.iterator](): IterableIterator<[Entity, ...T]>;
}
