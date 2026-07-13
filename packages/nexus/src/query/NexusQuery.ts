import { IComponentStore } from "../ComponentStore";
import { Component, Entity } from "../nexus-types";
import { Query } from "./Query";

export class NexusQuery<T extends object[] = object[]> implements Query<T> {
  private readonly stores: IComponentStore[];
  private readonly baseStore: IComponentStore;
  private readonly types: Component[];

  constructor(
    stores: IComponentStore[],
    baseStore: IComponentStore,
    types: Component[],
  ) {
    this.stores = stores;
    this.baseStore = baseStore;
    this.types = types;
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
    const entities: ReadonlyArray<Entity> = this.baseStore.getEntities();

    for (let i: number = 0; i < entities.length; i++) {
      const entity: Entity = entities[i];
      if (this.matches(entity)) {
        result.push(entity);
      }
    }

    return result;
  }

  public each(fn: (entity: Entity, ...components: T) => void): void {
    const stores: IComponentStore[] = this.stores;
    const base: IComponentStore = this.baseStore;
    const entities: ReadonlyArray<Entity> = base.getEntities();
    const storeCount: number = stores.length;
    const version: number = base.version;

    // Reused across iterations: fn.apply reads it in place, so zero alloc/entity.
    const args: unknown[] = new Array(storeCount + 1);

    for (let i: number = 0; i < base.size; i++) {
      if (base.version !== version) {
        throw new Error(this.structuralChangeMessage());
      }

      const entity: Entity = entities[i];
      args[0] = entity;

      let matched: boolean = true;

      for (let j: number = 0; j < storeCount; j++) {
        const component: unknown = stores[j].get(entity);

        if (component === undefined) {
          matched = false;
          break;
        }

        args[j + 1] = component;
      }

      if (matched) {
        (fn as (...args: unknown[]) => void).apply(undefined, args);
      }
    }
  }

  public *entities(): IterableIterator<Entity> {
    const base: IComponentStore = this.baseStore;
    const entities: ReadonlyArray<Entity> = base.getEntities();
    const version: number = base.version;

    for (let i: number = 0; i < base.size; i++) {
      if (base.version !== version) {
        throw new Error(this.structuralChangeMessage());
      }

      const entity: Entity = entities[i];
      if (this.matches(entity)) {
        yield entity;
      }
    }
  }

  public *[Symbol.iterator](): IterableIterator<[Entity, ...T]> {
    const stores: IComponentStore[] = this.stores;
    const base: IComponentStore = this.baseStore;
    const entities: ReadonlyArray<Entity> = base.getEntities();
    const storeCount: number = stores.length;
    const version: number = base.version;

    for (let i: number = 0; i < base.size; i++) {
      if (base.version !== version) {
        throw new Error(this.structuralChangeMessage());
      }

      const entity: Entity = entities[i];
      const tuple: unknown[] = [entity];

      let matched: boolean = true;

      for (let j: number = 0; j < storeCount; j++) {
        const component: unknown = stores[j].get(entity);

        if (component === undefined) {
          matched = false;
          break;
        }

        tuple.push(component);
      }

      if (matched) {
        yield tuple as [Entity, ...T];
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

  private structuralChangeMessage(): string {
    const names: string = this.types.map((type: Component) => type.name).join(", ");
    return `Structural change during query iteration over [${names}]. Defer it with world.commands instead of mutating the world directly inside the loop.`;
  }
}
