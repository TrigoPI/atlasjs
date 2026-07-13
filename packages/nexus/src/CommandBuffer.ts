import { Component, Entity } from "./nexus-types";

// prettier-ignore
export interface CommandBuffer {
  spawn(): Entity;
  destroy(entity: Entity): void;
  add<T extends object, A extends unknown[]>(entity: Entity, component: Component<T, A>, ...args: A): void;
  set<T extends object, A extends unknown[]>(entity: Entity, component: Component<T, A>, ...args: A): void;
  remove<T extends object>(entity: Entity, component: Component<T>): void;
}

// prettier-ignore
export interface CommandTarget {
  createEntity(): Entity;
  exists(entity: Entity): boolean;
  destroyEntity(entity: Entity): boolean;
  addComponent<T extends object, A extends unknown[]>(entity: Entity, component: Component<T, A>, ...args: A): T;
  setComponent<T extends object, A extends unknown[]>(entity: Entity, component: Component<T, A>, ...args: A): T;
  removeComponent<T extends object>(entity: Entity, component: Component<T>): boolean;
}

export class NexusCommandBuffer implements CommandBuffer {
  private readonly world: CommandTarget;
  private readonly queue: Array<() => void>;

  public constructor(world: CommandTarget) {
    this.world = world;
    this.queue = [];
  }

  public get size(): number {
    return this.queue.length;
  }

  public spawn(): Entity {
    return this.world.createEntity();
  }

  public destroy(entity: Entity): void {
    this.queue.push(() => {
      if (this.world.exists(entity)) {
        this.world.destroyEntity(entity);
      }
    });
  }

  public add<T extends object, A extends unknown[]>(
    entity: Entity,
    component: Component<T, A>,
    ...args: A
  ): void {
    this.queue.push(() => this.world.addComponent(entity, component, ...args));
  }

  public set<T extends object, A extends unknown[]>(
    entity: Entity,
    component: Component<T, A>,
    ...args: A
  ): void {
    this.queue.push(() => this.world.setComponent(entity, component, ...args));
  }

  public remove<T extends object>(
    entity: Entity,
    component: Component<T>,
  ): void {
    this.queue.push(() => this.world.removeComponent(entity, component));
  }

  public flush(): void {
    const queue: Array<() => void> = this.queue;

    for (let i: number = 0; i < queue.length; i++) {
      queue[i]();
    }

    queue.length = 0;
  }

  public clear(): void {
    this.queue.length = 0;
  }
}
