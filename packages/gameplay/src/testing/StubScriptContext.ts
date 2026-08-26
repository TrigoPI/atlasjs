import type { Component, Entity } from "@atlasjs/nexus";

import type {
  GameEntity,
  InstantiateArgs,
  Prefab,
  ScriptComponentToken,
  ScriptContext,
  ScriptServiceCtor,
} from "../scripting/core";

import { isScriptComponentToken } from "../scripting/core";

import { createDetachedGameEntity } from "./DetachedGameEntity";
import { stubEntity } from "./stubEntity";

export type StubComponentKey =
  | Component<object, any[]>
  | ScriptComponentToken<unknown, object, any[]>;

export type StubServiceKey = ScriptServiceCtor<unknown, unknown>;

export type StubComponentEntries = Iterable<
  readonly [StubComponentKey, unknown]
>;

export type StubServiceEntries = Iterable<readonly [StubServiceKey, unknown]>;

export type WrapEntity = (entity: Entity) => GameEntity;

export interface InstantiateRecord {
  readonly prefab: unknown;
  readonly params: unknown;
  readonly options: unknown;
}

export interface StubScriptContextOptions {
  entityId?: Entity;
  components?: StubComponentEntries;
  services?: StubServiceEntries;
  wrapEntity?: WrapEntity;
}

const DEFAULT_ENTITY: Entity = stubEntity(1);

// prettier-ignore
export class StubScriptContext implements ScriptContext {
  public readonly instantiations: InstantiateRecord[];

  private readonly entity: Entity;
  private readonly components: Map<object, unknown>;
  private readonly services: Map<object, unknown>;
  private readonly wrapEntity: WrapEntity;

  private destroyCount: number;

  public constructor(options: StubScriptContextOptions = {}) {
    this.entity = options.entityId ?? DEFAULT_ENTITY;
    this.components = new Map<object, unknown>(options.components ?? []);
    this.services = new Map<object, unknown>(options.services ?? []);
    this.wrapEntity = options.wrapEntity ?? createDetachedGameEntity;
    this.instantiations = [];
    this.destroyCount = 0;
  }

  public get destroyCalls(): number {
    return this.destroyCount;
  }

  public getEntityId(): Entity {
    return this.entity;
  }

  public getEntity(entity: Entity): GameEntity {
    return this.wrapEntity(entity);
  }

  public getService<TFacade, TService>(type: ScriptServiceCtor<TFacade, TService>): TFacade;
  public getService(type: object): unknown {
    if (!this.services.has(type)) {
      throw new Error(
        `[StubScriptContext] No service was registered for "${this.nameOf(type)}". Add it to the "services" table — the runtime throws here too. Register it with the value "undefined" to simulate a façade that resolves to nothing.`,
      );
    }

    return this.services.get(type);
  }

  public hasComponent(type: Component<object, any[]> | ScriptComponentToken<unknown, object, any[]>): boolean;
  public hasComponent(type: object): boolean {
    return this.components.has(type);
  }

  public getComponent<TApi, TEngine extends object>(type: ScriptComponentToken<TApi, TEngine, any[]>): TApi | undefined;
  public getComponent<TComponent extends object>(type: Component<TComponent, any[]>): TComponent | undefined;
  public getComponent(type: object): unknown {
    return this.components.get(type);
  }

  public addComponent<TApi, TEngine extends object, TArgs extends unknown[]>(type: ScriptComponentToken<TApi, TEngine, TArgs>, ...args: TArgs): TApi;
  public addComponent<TComponent extends object, TArgs extends unknown[]>(type: Component<TComponent, TArgs>, ...args: TArgs): TComponent;
  public addComponent(type: object): unknown {
    if (!this.components.has(type)) {
      throw new Error(
        `[StubScriptContext] Cannot build "${this.nameOf(type)}": the stub owns no world. Add the component to the "components" table instead.`,
      );
    }

    return this.components.get(type);
  }

  public removeComponent(type: Component<object, any[]> | ScriptComponentToken<unknown, object, any[]>): void;
  public removeComponent(type: object): void {
    this.components.delete(type);
  }

  public instantiate<TParams>(prefab: Prefab<TParams>, ...rest: InstantiateArgs<TParams>): GameEntity;
  public instantiate(prefab: unknown, ...rest: readonly unknown[]): GameEntity {
    this.instantiations.push({ prefab, params: rest[0], options: rest[1] });

    return this.wrapEntity(stubEntity(this.instantiations.length));
  }

  public destroy(): void {
    this.destroyCount += 1;
  }

  private nameOf(type: object): string {
    if (isScriptComponentToken(type)) {
      return type.engine.name;
    }

    return type instanceof Function ? type.name : String(type);
  }
}
