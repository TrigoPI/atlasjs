import { Entity } from "../types";
import { SparseSet } from "./SparseSet";

export interface IComponentStore<T = any> {
  readonly size: number;
  readonly version: number;
  has(entity: Entity): boolean;
  get(entity: Entity): T | undefined;
  set(entity: Entity, component: T): void;
  delete(entity: Entity): boolean;
  getEntities(): ReadonlyArray<Entity>;
  entities(): IterableIterator<Entity>;
  values(): IterableIterator<T>;
  entries(): IterableIterator<[Entity, T]>;
}

export class SparseSetStore<T = any> implements IComponentStore<T> {
  private readonly store: SparseSet<T>;

  private structuralVersion: number;

  public constructor() {
    this.store = new SparseSet<T>();
    this.structuralVersion = 0;
  }

  public get size(): number {
    return this.store.size;
  }

  public get version(): number {
    return this.structuralVersion;
  }

  public has(entity: Entity): boolean {
    return this.store.has(entity);
  }

  public getEntities(): ReadonlyArray<Entity> {
    return this.store.getEntities();
  }

  public get(entity: Entity): T | undefined {
    return this.store.get(entity);
  }

  public set(entity: Entity, component: T): void {
    if (this.store.set(entity, component)) {
      this.structuralVersion++;
    }
  }

  public delete(entity: Entity): boolean {
    const removed: boolean = this.store.delete(entity);

    if (removed) {
      this.structuralVersion++;
    }

    return removed;
  }

  public *entities(): IterableIterator<Entity> {
    yield* this.store.entities();
  }

  public *values(): IterableIterator<T> {
    yield* this.store.values();
  }

  public *entries(): IterableIterator<[Entity, T]> {
    yield* this.store.entries();
  }
}
