import { createLogger, Logger } from "@atlasjs/utils";

import { defineComponent } from "./define-component";
import { Query, EmptyQuery, NexusQuery } from "./query";
import { EntityManager } from "./EntityManager";
import { ComponentStore } from "./ComponentStore";

import {
  Component,
  ComponentData,
  ComponentID,
  ComponentList,
  Entity,
} from "./nexus-types";

export class NexusWorld {
  private readonly logger: Logger;
  private readonly entityManager: EntityManager;
  private readonly stores: Map<ComponentID, ComponentStore<any>>;

  public constructor() {
    this.logger = createLogger(NexusWorld.name);
    this.entityManager = new EntityManager();
    this.stores = new Map();
  }

  public exists(entity: Entity): boolean {
    return this.entityManager.has(entity);
  }

  public hasComponent<TComponent extends object>(
    entity: Entity,
    component: Component<TComponent>,
  ): boolean {
    this.assertEntityExists(entity);

    const store: ComponentStore<TComponent> | undefined =
      this.findStore(component);

    if (store === undefined) {
      return false;
    }

    return store.has(entity);
  }

  public getStore<TComponent extends object>(
    type: Component<TComponent>,
  ): ComponentStore<TComponent> {
    return this.getOrCreateStore(type);
  }

  public removeComponent<TComponent extends object>(
    entity: Entity,
    type: Component<TComponent>,
  ): boolean {
    this.assertEntityExists(entity);

    const store: ComponentStore<TComponent> | undefined = this.findStore(type);

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
    defineComponent(component);
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

    const store: ComponentStore<TComponent> | undefined = this.findStore(type);

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
    const store: ComponentStore<TComponent> =
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
    const store: ComponentStore<TComponent> = this.getOrCreateStore(component);

    const instance: TComponent = new component(...args);
    store.set(entity, instance);

    return instance;
  }

  public query(...types: Component<any, any>[]): Query {
    if (types.length === 0) {
      throw new Error("Query requires at least one component type.");
    }

    const stores: ComponentStore<any>[] = [];

    for (const type of types) {
      const store: ComponentStore | undefined = this.findStore(type);

      if (store === undefined) {
        return new EmptyQuery();
      }

      stores.push(store);
    }

    let baseStore: ComponentStore = stores[0];

    for (let i = 1; i < stores.length; i++) {
      if (stores[i].size < baseStore.size) {
        baseStore = stores[i];
      }
    }

    return new NexusQuery(stores, baseStore);
  }

  public destroy(): void {
    this.logger.log(`Destroying NexusWorld.`);
    this.entityManager.clear();
    this.stores.clear();
  }

  private getOrCreateStore<TComponent extends object>(
    component: Component<TComponent>,
  ): ComponentStore<TComponent> {
    this.assertComponentData(component);

    let store: ComponentStore<any> | undefined = this.stores.get(
      component.componentID,
    );

    if (store !== undefined) {
      return store;
    }

    store = new ComponentStore<TComponent>();
    this.stores.set(component.componentID, store);

    return store;
  }

  private findStore<TComponent extends object>(
    component: Component<TComponent>,
  ): ComponentStore<TComponent> | undefined {
    this.assertComponentData(component);
    return this.stores.get(component.componentID) as
      | ComponentStore<TComponent>
      | undefined;
  }

  private assertEntityExists(entity: Entity): void {
    if (!this.entityManager.has(entity)) {
      throw new Error(`Entity ${entity} does not exist.`);
    }
  }

  private assertComponentData<TComponent extends object>(
    component: Component<TComponent>,
  ): asserts component is ComponentData<TComponent> {
    if ((component as unknown as any)["componentID"] === undefined) {
      throw new Error(
        `Component ${component.name} is not a valid ComponentData.`,
      );
    }
  }
}
