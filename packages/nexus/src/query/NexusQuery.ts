import { ComponentStore } from "../ComponentStore";
import { Entity } from "../nexus-types";
import { Query } from "./Query";

export class NexusQuery implements Query {
  private readonly stores: ComponentStore[];
  private readonly baseStore: ComponentStore;

  constructor(stores: ComponentStore[], baseStore: ComponentStore) {
    this.stores = stores;
    this.baseStore = baseStore;
  }

  public get size(): number {
    let count: number = 0;

    for (const _ of this.entities()) {
      count++;
    }

    return count;
  }

  public has(entity: Entity): boolean {
    return this.matches(entity);
  }

  public getEntities(): Entity[] {
    const result: Entity[] = [];

    for (let i: number = 0; i < this.baseStore.size; i++) {
      const entity: Entity = this.baseStore.getEntities()[i];
      if (this.matches(entity)) {
        result.push(entity);
      }
    }

    return result;
  }

  public *entities(): IterableIterator<Entity> {
    // Classic for loop for maximum speed 🏎️
    for (let i: number = 0; i < this.baseStore.size; i++) {
      const entity: Entity = this.baseStore.getEntities()[i];
      if (this.matches(entity)) {
        yield entity;
      }
    }
  }

  private matches(entity: Entity): boolean {
    for (const store of this.stores) {
      if (!store.has(entity)) {
        return false;
      }
    }

    return true;
  }
}
