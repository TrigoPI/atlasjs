import { Entity } from "../nexus-types";
import { Query } from "./Query";

export class EmptyQuery<T extends object[] = object[]> implements Query<T> {
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
}
