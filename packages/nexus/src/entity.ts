import { Entity } from "./nexus-types";

export const ENTITY_INDEX_BITS: number = 21;
export const ENTITY_INDEX_CAPACITY: number = 1 << ENTITY_INDEX_BITS;
export const ENTITY_MAX_GENERATION: number = Math.floor(
  Number.MAX_SAFE_INTEGER / ENTITY_INDEX_CAPACITY,
);

export function makeEntity(index: number, generation: number): Entity {
  return (generation * ENTITY_INDEX_CAPACITY + index) as Entity;
}

export function entityIndex(entity: Entity): number {
  return entity % ENTITY_INDEX_CAPACITY;
}

export function entityGeneration(entity: Entity): number {
  return Math.floor(entity / ENTITY_INDEX_CAPACITY);
}
