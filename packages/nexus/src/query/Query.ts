import { Entity } from "../nexus-types";

export interface Query {
  readonly size: number;
  has(entity: Entity): boolean;
  getEntities(): Entity[];
  entities(): Iterable<Entity>;
}
