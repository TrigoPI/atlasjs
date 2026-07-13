import { Component, ComponentID } from "./nexus-types";

export class ComponentRegistry {
  private readonly ids: Map<Component, ComponentID>;
  private nextId: number;

  public constructor() {
    this.ids = new Map();
    this.nextId = 0;
  }

  public get size(): number {
    return this.ids.size;
  }

  public register(component: Component): ComponentID {
    let id: ComponentID | undefined = this.ids.get(component);

    if (id === undefined) {
      id = this.nextId++ as ComponentID;
      this.ids.set(component, id);
    }

    return id;
  }

  public get(component: Component): ComponentID | undefined {
    return this.ids.get(component);
  }

  public has(component: Component): boolean {
    return this.ids.has(component);
  }
}

export const defaultComponentRegistry: ComponentRegistry = new ComponentRegistry();
