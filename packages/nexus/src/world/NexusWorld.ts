import { createLogger, Logger } from "@atlasjs/utils";

import { Query, EmptyQuery, NexusQuery, StoreResolver } from "../query";
import { EntityManager } from "../entity";
import { CommandBuffer, NexusCommandBuffer } from "../command";
import {
  ComponentRegistry,
  defaultComponentRegistry,
  IComponentStore,
  SparseSetStore,
} from "../component";

import {
  Component,
  ComponentID,
  ComponentList,
  ComponentListener,
  Entity,
  Unsubscribe,
} from "../types";

export class NexusWorld {
  private readonly logger: Logger;
  private readonly registry: ComponentRegistry;
  private readonly entityManager: EntityManager;
  private readonly stores: Map<ComponentID, IComponentStore<any>>;
  private readonly commandBuffer: NexusCommandBuffer;
  private readonly addListeners: Map<ComponentID, Set<ComponentListener>>;
  private readonly removeListeners: Map<ComponentID, Set<ComponentListener>>;

  public constructor(registry: ComponentRegistry = defaultComponentRegistry) {
    this.logger = createLogger(NexusWorld.name);
    this.registry = registry;
    this.entityManager = new EntityManager();
    this.stores = new Map();
    this.commandBuffer = new NexusCommandBuffer(this);
    this.addListeners = new Map();
    this.removeListeners = new Map();
  }

  public get commands(): CommandBuffer {
    return this.commandBuffer;
  }

  public flush(): void {
    this.commandBuffer.flush();
  }

  public onAdd<TComponent extends object>(
    component: Component<TComponent>,
    listener: ComponentListener<TComponent>,
  ): Unsubscribe {
    return this.subscribe(this.addListeners, component, listener);
  }

  public onRemove<TComponent extends object>(
    component: Component<TComponent>,
    listener: ComponentListener<TComponent>,
  ): Unsubscribe {
    return this.subscribe(this.removeListeners, component, listener);
  }

  public exists(entity: Entity): boolean {
    return this.entityManager.has(entity);
  }

  public hasComponent<TComponent extends object>(
    entity: Entity,
    component: Component<TComponent>,
  ): boolean {
    if (!this.entityManager.has(entity)) {
      return false;
    }

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

    const instance: TComponent | undefined = store.get(entity);
    const removed: boolean = store.delete(entity);

    if (removed) {
      this.emit(this.removeListeners, this.registry.register(type), entity, instance!);
    }

    return removed;
  }

  public destroyEntity(entity: Entity): boolean {
    this.assertEntityExists(entity);

    for (const [id, store] of this.stores) {
      const instance: unknown = store.get(entity);

      if (store.delete(entity)) {
        this.emit(this.removeListeners, id, entity, instance as object);
      }
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
  ): TComponent;
  public addComponent<TComponent extends object>(
    entity: Entity,
    instance: TComponent,
  ): TComponent;
  public addComponent<TComponent extends object, TArgs extends unknown[]>(
    entity: Entity,
    component: Component<TComponent, TArgs> | TComponent,
    ...args: TArgs
  ): TComponent {
    this.assertEntityExists(entity);

    const isConstructor: boolean = typeof component === "function";
    const type: Component<TComponent, TArgs> = (
      isConstructor
        ? component
        : (component as TComponent).constructor
    ) as Component<TComponent, TArgs>;

    const store: IComponentStore<TComponent> =
      this.getOrCreateStore<TComponent>(type);

    if (store.has(entity)) {
      throw new Error(
        `Entity ${entity} already has component "${type.name}".`,
      );
    }

    const instance: TComponent = isConstructor
      ? new (component as Component<TComponent, TArgs>)(...args)
      : (component as TComponent);

    store.set(entity, instance);
    this.emit(this.addListeners, this.registry.register(type), entity, instance);

    return instance;
  }

  public setComponent<TComponent extends object, TArgs extends unknown[]>(
    entity: Entity,
    component: Component<TComponent, TArgs>,
    ...args: TArgs
  ): TComponent {
    this.assertEntityExists(entity);
    const store: IComponentStore<TComponent> = this.getOrCreateStore(component);
    const existed: boolean = store.has(entity);

    const instance: TComponent = new component(...args);
    store.set(entity, instance);

    if (!existed) {
      this.emit(
        this.addListeners,
        this.registry.register(component),
        entity,
        instance,
      );
    }

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

    const resolve: StoreResolver = (component: Component) =>
      this.findStore(component);

    return new NexusQuery<T>(resolve, stores, types as Component[]);
  }

  public destroy(): void {
    this.logger.log(`Destroying NexusWorld.`);
    this.commandBuffer.clear();
    this.entityManager.clear();
    this.stores.clear();
    this.addListeners.clear();
    this.removeListeners.clear();
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

  private subscribe<TComponent extends object>(
    listeners: Map<ComponentID, Set<ComponentListener>>,
    component: Component<TComponent>,
    listener: ComponentListener<TComponent>,
  ): Unsubscribe {
    const id: ComponentID = this.registry.register(component);

    let set: Set<ComponentListener> | undefined = listeners.get(id);

    if (set === undefined) {
      set = new Set();
      listeners.set(id, set);
    }

    set.add(listener as ComponentListener);

    return () => {
      listeners.get(id)?.delete(listener as ComponentListener);
    };
  }

  private emit(
    listeners: Map<ComponentID, Set<ComponentListener>>,
    id: ComponentID,
    entity: Entity,
    component: object,
  ): void {
    const set: Set<ComponentListener> | undefined = listeners.get(id);

    if (set === undefined) {
      return;
    }

    for (const listener of set) {
      listener(entity, component);
    }
  }
}
