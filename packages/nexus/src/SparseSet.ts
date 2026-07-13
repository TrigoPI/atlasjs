import { Entity } from ".";
import { entityIndex } from "./entity";

export class SparseSet<T> {
  private readonly sparse: number[];
  private readonly dense: Entity[];
  private readonly data: T[];

  public constructor() {
    this.sparse = [];
    this.dense = [];
    this.data = [];
  }

  public get size(): number {
    return this.dense.length;
  }

  public has(entity: Entity): boolean {
    const index: number = this.sparse[entityIndex(entity)];
    return index !== undefined && this.dense[index] === entity;
  }

  public delete(entity: Entity): boolean {
    const index: number = this.sparse[entityIndex(entity)];

    if (index === undefined || this.dense[index] !== entity) {
      return false;
    }

    const lastIndex: number = this.dense.length - 1;
    const lastEntity: Entity = this.dense[lastIndex];
    const lastValue: T = this.data[lastIndex];

    if (index !== lastIndex) {
      this.dense[index] = lastEntity;
      this.data[index] = lastValue;
      this.sparse[entityIndex(lastEntity)] = index;
    }

    this.dense.pop();
    this.data.pop();
    this.sparse[entityIndex(entity)] = undefined as unknown as number;

    return true;
  }

  public getEntities(): ReadonlyArray<Entity> {
    return this.dense;
  }

  public require(entity: Entity): T {
    const value: T | undefined = this.get(entity);

    if (!value) {
      throw new Error(`Missing component for entity ${entity}`);
    }

    return value;
  }

  public get(entity: Entity): T | undefined {
    const index: number = this.sparse[entityIndex(entity)];

    if (index === undefined || this.dense[index] !== entity) {
      return undefined;
    }

    return this.data[index];
  }

  public set(entity: Entity, value: T): boolean {
    const index: number = this.sparse[entityIndex(entity)];

    if (index !== undefined && this.dense[index] === entity) {
      this.data[index] = value;
      return false;
    }

    const nextIndex: number = this.dense.length;

    this.sparse[entityIndex(entity)] = nextIndex;
    this.dense.push(entity);
    this.data.push(value);

    return true;
  }

  public clear(): void {
    this.sparse.length = 0;
    this.dense.length = 0;
    this.data.length = 0;
  }

  public *entities(): IterableIterator<Entity> {
    yield* this.dense;
  }

  public *values(): IterableIterator<T> {
    yield* this.data;
  }

  public *entries(): IterableIterator<[Entity, T]> {
    for (let i = 0; i < this.dense.length; i++) {
      yield [this.dense[i], this.data[i]];
    }
  }
}
