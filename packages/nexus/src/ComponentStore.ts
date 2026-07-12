import { Entity } from "./nexus-types";
import { SparseSet } from "./SparseSet";

export class ComponentStore<T = any> {
  private readonly store: SparseSet<T>;

  public constructor() {
    this.store = new SparseSet<T>();
  }

  public get size(): number {
    return this.store.size;
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
    this.store.set(entity, component);
  }

  public delete(entity: Entity): boolean {
    return this.store.delete(entity);
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
