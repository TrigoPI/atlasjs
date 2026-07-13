import { IComponentStore } from "../ComponentStore";
import { Component, Entity } from "../nexus-types";
import { Query } from "./Query";

export type StoreResolver = (
  component: Component,
) => IComponentStore | undefined;

export class NexusQuery<T extends unknown[] = unknown[]> implements Query<T> {
  private readonly resolve: StoreResolver;
  private readonly required: IComponentStore[];
  private readonly requiredTypes: Component[];
  private readonly optionalStores: Array<IComponentStore | undefined>;
  private readonly excluded: IComponentStore[];
  private readonly baseStore: IComponentStore;

  constructor(
    resolve: StoreResolver,
    required: IComponentStore[],
    requiredTypes: Component[],
    optional: Array<IComponentStore | undefined> = [],
    excluded: IComponentStore[] = [],
  ) {
    this.resolve = resolve;
    this.required = required;
    this.requiredTypes = requiredTypes;
    this.optionalStores = optional;
    this.excluded = excluded;
    this.baseStore = this.smallest(required);
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

  public without(...types: Component<any, any[]>[]): Query<T> {
    const excluded: IComponentStore[] = this.excluded.slice();

    for (const type of types) {
      const store: IComponentStore | undefined = this.resolve(type);
      // A never-used component excludes nothing, so an absent store is a no-op.
      if (store !== undefined) {
        excluded.push(store);
      }
    }

    return new NexusQuery<T>(
      this.resolve,
      this.required,
      this.requiredTypes,
      this.optionalStores,
      excluded,
    );
  }

  public optional<U extends object[]>(
    ...types: { [K in keyof U]: Component<U[K], any[]> }
  ): Query<[...T, ...{ [K in keyof U]: U[K] | undefined }]> {
    const optional: Array<IComponentStore | undefined> = this.optionalStores.slice();

    for (const type of types as Component[]) {
      // Absent store -> the component is always undefined for every entity.
      optional.push(this.resolve(type));
    }

    return new NexusQuery(
      this.resolve,
      this.required,
      this.requiredTypes,
      optional,
      this.excluded,
    ) as unknown as Query<[...T, ...{ [K in keyof U]: U[K] | undefined }]>;
  }

  public each(fn: (entity: Entity, ...components: T) => void): void {
    const base: IComponentStore = this.baseStore;
    const entities: ReadonlyArray<Entity> = base.getEntities();
    const required: IComponentStore[] = this.required;
    const optional: Array<IComponentStore | undefined> = this.optionalStores;
    const excluded: IComponentStore[] = this.excluded;
    const requiredCount: number = required.length;
    const optionalCount: number = optional.length;
    const excludedCount: number = excluded.length;
    const version: number = base.version;

    // Reused across iterations: fn.apply reads it in place, so zero alloc/entity.
    const args: unknown[] = new Array(1 + requiredCount + optionalCount);

    for (let i: number = 0; ; i++) {
      // Checked before the bounds test so a same-loop structural change is
      // caught even when it shrinks the base below the current index.
      if (base.version !== version) {
        throw new Error(this.structuralChangeMessage());
      }

      if (i >= base.size) {
        break;
      }

      const entity: Entity = entities[i];

      if (this.isExcluded(entity, excluded, excludedCount)) {
        continue;
      }

      args[0] = entity;

      let matched: boolean = true;

      for (let j: number = 0; j < requiredCount; j++) {
        const component: unknown = required[j].get(entity);

        if (component === undefined) {
          matched = false;
          break;
        }

        args[j + 1] = component;
      }

      if (!matched) {
        continue;
      }

      for (let j: number = 0; j < optionalCount; j++) {
        const store: IComponentStore | undefined = optional[j];
        args[requiredCount + 1 + j] =
          store !== undefined ? store.get(entity) : undefined;
      }

      (fn as (...args: unknown[]) => void).apply(undefined, args);
    }
  }

  public *entities(): IterableIterator<Entity> {
    const base: IComponentStore = this.baseStore;
    const entities: ReadonlyArray<Entity> = base.getEntities();
    const version: number = base.version;

    for (let i: number = 0; ; i++) {
      // Checked before the bounds test so a same-loop structural change is
      // caught even when it shrinks the base below the current index.
      if (base.version !== version) {
        throw new Error(this.structuralChangeMessage());
      }

      if (i >= base.size) {
        break;
      }

      const entity: Entity = entities[i];
      if (this.matches(entity)) {
        yield entity;
      }
    }
  }

  public *[Symbol.iterator](): IterableIterator<[Entity, ...T]> {
    const base: IComponentStore = this.baseStore;
    const entities: ReadonlyArray<Entity> = base.getEntities();
    const required: IComponentStore[] = this.required;
    const optional: Array<IComponentStore | undefined> = this.optionalStores;
    const excluded: IComponentStore[] = this.excluded;
    const requiredCount: number = required.length;
    const optionalCount: number = optional.length;
    const excludedCount: number = excluded.length;
    const version: number = base.version;

    for (let i: number = 0; ; i++) {
      // Checked before the bounds test so a same-loop structural change is
      // caught even when it shrinks the base below the current index.
      if (base.version !== version) {
        throw new Error(this.structuralChangeMessage());
      }

      if (i >= base.size) {
        break;
      }

      const entity: Entity = entities[i];

      if (this.isExcluded(entity, excluded, excludedCount)) {
        continue;
      }

      const tuple: unknown[] = [entity];

      let matched: boolean = true;

      for (let j: number = 0; j < requiredCount; j++) {
        const component: unknown = required[j].get(entity);

        if (component === undefined) {
          matched = false;
          break;
        }

        tuple.push(component);
      }

      if (!matched) {
        continue;
      }

      for (let j: number = 0; j < optionalCount; j++) {
        const store: IComponentStore | undefined = optional[j];
        tuple.push(store !== undefined ? store.get(entity) : undefined);
      }

      yield tuple as [Entity, ...T];
    }
  }

  private smallest(stores: IComponentStore[]): IComponentStore {
    let base: IComponentStore = stores[0];

    for (let i: number = 1; i < stores.length; i++) {
      if (stores[i].size < base.size) {
        base = stores[i];
      }
    }

    return base;
  }

  private isExcluded(
    entity: Entity,
    excluded: IComponentStore[],
    count: number,
  ): boolean {
    for (let j: number = 0; j < count; j++) {
      if (excluded[j].has(entity)) {
        return true;
      }
    }

    return false;
  }

  private matches(entity: Entity): boolean {
    for (const store of this.required) {
      if (!store.has(entity)) {
        return false;
      }
    }

    for (const store of this.excluded) {
      if (store.has(entity)) {
        return false;
      }
    }

    return true;
  }

  private structuralChangeMessage(): string {
    const names: string = this.requiredTypes
      .map((type: Component) => type.name)
      .join(", ");
    return `Structural change during query iteration over [${names}]. Defer it with world.commands instead of mutating the world directly inside the loop.`;
  }
}
