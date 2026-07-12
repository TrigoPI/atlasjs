import { Entity } from "../nexus-types";
import { Query } from "./Query";

export class EmptyQuery implements Query {
  public get size(): number {
    return 0;
  }

  public has(entity: Entity): boolean {
    return false;
  }

  public getEntities(): Entity[] {
    return [];
  }

  public *entities(): IterableIterator<Entity> {}
}
