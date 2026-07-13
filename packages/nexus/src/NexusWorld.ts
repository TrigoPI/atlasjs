import { createLogger, Logger } from "@atlasjs/utils";

import { Query, EmptyQuery, NexusQuery } from "./query";
import { EntityManager } from "./EntityManager";
import { IComponentStore, SparseSetStore } from "./ComponentStore";
import { CommandBuffer, NexusCommandBuffer } from "./CommandBuffer";
import {
  ComponentRegistry,
  defaultComponentRegistry,
} from "./ComponentRegistry";

import {
  Component,
  ComponentID,
  ComponentList,
  Entity,
} from "./nexus-types";

export class NexusWorld {
  private readonly logger: Logger;
  private readonly registry: ComponentRegistry;
  private readonly entityManager: EntityManager;
  private readonly stores: Map<ComponentID, IComponentStore<any>>;
  private readonly commandBuffer: NexusCommandBuffer;

  public constructor(registry: ComponentRegistry = defaultComponentRegistry) {
    this.logger = createLogger(NexusWorld.name);
    this.registry = registry;
    this.entityManager = new EntityManager();
    this.stores = new Map();
    this.commandBuffer = new NexusCommandBuffer(this);
  }

  public get commands(): CommandBuffer {
    return this.commandBuffer;
  }

  public flush(): void {
    this.commandBuffer.flush();
  }

  public exists(entity: Entity): boolean {
    return this.entityManager.has(entity);
  }

  public hasComponent<TComponent extends object>(
    entity: Entity,
    component: Component<TComponent>,
  ): boolean {
    this.assertEntityExists(entity);

    const store: IComponentStore<TComponent> | undefined =
      this.findStore(component);

    if (store === undefined) {
      return false;
    }

    return store.has(entity);
  }

  public getStore<TComponent extends object>(
    type: Component<TComponent>,
  ): IComponentStore<TComponent> {
    return this.getOrCreateStore(type);
  }

  public removeComponent<TComponent extends object>(
    entity: Entity,
    type: Component<TComponent>,
  ): boolean {
    this.assertEntityExists(entity);

    const store: IComponentStore<TComponent> | undefined = this.findStore(type);

    if (store === undefined) {
      return false;
    }

    return store.delete(entity);
  }

  public destroyEntity(entity: Entity): boolean {
    this.assertEntityExists(entity);

    for (const store of this.stores.values()) {
      store.delete(entity);
    }

    return this.entityManager.destroy(entity);
  }

  public defineComponent<TComponent extends object, TArgs extends unknown[]>(
    component: Component<TComponent, TArgs>,
  ): NexusWorld {
    this.logger.log(`Defining component "${component.name}".`);
    this.registry.register(component);
    return this;
  }

  public createEntity(): Entity {
    return this.entityManager.create();
  }

  public getComponent<TComponent extends object, TArgs extends unknown[]>(
    entity: Entity,
    type: Component<TComponent, TArgs>,
  ): TComponent | undefined {
    this.assertEntityExists(entity);

    const store: IComponentStore<TComponent> | undefined = this.findStore(type);

    if (store === undefined) {
      return undefined;
    }

    return store.get(entity);
  }

  public requireComponents<TComponent extends object[]>(
    entity: Entity,
    ...types: ComponentList<TComponent, any>
  ): TComponent {
    return types.map((type: Component) =>
      this.requireComponent(entity, type),
    ) as TComponent;
  }

  public requireComponent<TComponent extends object>(
    entity: Entity,
    type: Component<TComponent>,
  ): TComponent {
    const component: TComponent | undefined = this.getComponent(entity, type);

    if (component === undefined) {
      throw new Error(
        `Entity ${entity} does not have required component "${type.name}".`,
      );
    }

    return component;
  }

  public addComponent<TComponent extends object, TArgs extends unknown[]>(
    entity: Entity,
    component: Component<TComponent, TArgs>,
    ...args: TArgs
  ): TComponent {
    this.assertEntityExists(entity);
    const store: IComponentStore<TComponent> =
      this.getOrCreateStore<TComponent>(component);

    if (store.has(entity)) {
      throw new Error(
        `Entity ${entity} already has component "${component.constructor.name}".`,
      );
    }

    const instance: TComponent = new component(...args);
    store.set(entity, instance);

    return instance;
  }

  public setComponent<TComponent extends object, TArgs extends unknown[]>(
    entity: Entity,
    component: Component<TComponent, TArgs>,
    ...args: TArgs
  ): TComponent {
    this.assertEntityExists(entity);
    const store: IComponentStore<TComponent> = this.getOrCreateStore(component);

    const instance: TComponent = new component(...args);
    store.set(entity, instance);

    return instance;
  }

  public query<T extends object[]>(
    ...types: { [K in keyof T]: Component<T[K], any[]> }
  ): Query<T> {
    if (types.length === 0) {
      throw new Error("Query requires at least one component type.");
    }

    const stores: IComponentStore<any>[] = [];

    for (const type of types) {
      const store: IComponentStore | undefined = this.findStore(type);

      if (store === undefined) {
        return new EmptyQuery<T>();
      }

      stores.push(store);
    }

    let baseStore: IComponentStore = stores[0];

    for (let i = 1; i < stores.length; i++) {
      if (stores[i].size < baseStore.size) {
        baseStore = stores[i];
      }
    }

    return new NexusQuery<T>(stores, baseStore, types as Component[]);
  }

  public destroy(): void {
    this.logger.log(`Destroying NexusWorld.`);
    this.commandBuffer.clear();
    this.entityManager.clear();
    this.stores.clear();
  }

  private getOrCreateStore<TComponent extends object>(
    component: Component<TComponent>,
  ): IComponentStore<TComponent> {
    const id: ComponentID = this.registry.register(component);

    let store: IComponentStore<any> | undefined = this.stores.get(id);

    if (store !== undefined) {
      return store;
    }

    store = new SparseSetStore<TComponent>();
    this.stores.set(id, store);

    return store;
  }

  private findStore<TComponent extends object>(
    component: Component<TComponent>,
  ): IComponentStore<TComponent> | undefined {
    const id: ComponentID | undefined = this.registry.get(component);

    if (id === undefined) {
      return undefined;
    }

    return this.stores.get(id) as IComponentStore<TComponent> | undefined;
  }

  private assertEntityExists(entity: Entity): void {
    if (!this.entityManager.has(entity)) {
      throw new Error(`Entity ${entity} does not exist.`);
    }
  }
}
