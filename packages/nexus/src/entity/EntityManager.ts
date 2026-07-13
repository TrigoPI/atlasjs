import { Entity } from "./nexus-types";
import { entityGeneration, entityIndex, makeEntity } from "./entity";

export class EntityManager {
  private readonly generations: number[];
  private readonly alive: boolean[];
  private readonly freeIndices: number[];

  private aliveCount: number;
  private nextIndex: number;

  public constructor() {
    this.generations = [];
    this.alive = [];
    this.freeIndices = [];
    this.aliveCount = 0;
    this.nextIndex = 0;
  }

  public get size(): number {
    return this.aliveCount;
  }

  public destroy(entity: Entity): boolean {
    if (!this.has(entity)) {
      return false;
    }

    const index: number = entityIndex(entity);

    this.alive[index] = false;
    this.generations[index]++;
    this.freeIndices.push(index);
    this.aliveCount--;

    return true;
  }

  public has(entity: Entity): boolean {
    const index: number = entityIndex(entity);

    return (
      this.alive[index] === true &&
      this.generations[index] === entityGeneration(entity)
    );
  }

  public create(): Entity {
    let index: number;

    if (this.freeIndices.length > 0) {
      index = this.freeIndices.pop()!;
    } else {
      index = this.nextIndex++;
      this.generations[index] = 0;
    }

    this.alive[index] = true;
    this.aliveCount++;

    return makeEntity(index, this.generations[index]);
  }

  public clear(): void {
    this.generations.length = 0;
    this.alive.length = 0;
    this.freeIndices.length = 0;
    this.aliveCount = 0;
    this.nextIndex = 0;
  }
}
