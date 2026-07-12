import { Entity } from "./nexus-types";

export class EntityManager {
  private readonly freeEntities: Entity[];
  private readonly alive: Set<Entity>;

  private nextEntityId: Entity;

  public constructor() {
    this.freeEntities = [];
    this.alive = new Set<Entity>();
    this.nextEntityId = 0 as Entity;
  }

  public get size(): number {
    return this.alive.size;
  }

  public destroy(entity: Entity): boolean {
    if (!this.alive.delete(entity)) {
      return false;
    }

    this.freeEntities.push(entity);
    return true;
  }

  public has(entity: Entity): boolean {
    return this.alive.has(entity);
  }

  public create(): Entity {
    const entity: Entity =
      this.freeEntities.length > 0
        ? this.freeEntities.pop()!
        : (this.nextEntityId++ as Entity);

    this.alive.add(entity);

    return entity;
  }

  public clear(): void {
    this.freeEntities.length = 0;
    this.alive.clear();
  }
}
