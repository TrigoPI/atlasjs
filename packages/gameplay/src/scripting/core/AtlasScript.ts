import { Component, Entity } from "@atlasjs/nexus";

import { ScriptServiceCtor } from "./ScriptService";
import { ScriptContext } from "./ScriptContext";
import { ScriptLifecycle } from "./ScriptLifeCycle";
import type { GameEntity } from "./GameEntity";

import {
  ScriptComponentToken,
  isScriptComponentToken,
} from "./ScriptComponentToken";

// prettier-ignore
export abstract class AtlasScript<TProps extends object = {}> implements ScriptLifecycle {
  declare public readonly __props?: TProps;

  private __context?: ScriptContext;

  public onCreate?(): void;
  public onUpdate?(dt: number): void;
  public onFixedUpdate?(): void;
  public onDestroy?(): void;
  public onCollisionEnter?(other: GameEntity): void;
  public onCollisionExit?(other: GameEntity): void;
  public onTriggerEnter?(other: GameEntity): void;
  public onTriggerExit?(other: GameEntity): void;

  public __bindContext(context: ScriptContext): void {
    this.__context = context;
  }

  public __unbindContext(): void {
    this.__context = undefined;
  }

  protected get context(): ScriptContext {
    if (!this.__context) {
      throw new Error(
        "[AtlasScript] Script context is not bound. This script is being used outside of the runtime.",
      );
    }

    return this.__context;
  }

  public get entityId(): Entity {
    return this.context.getEntityId();
  }

  public getEntity(entity: Entity): GameEntity {
    return this.context.getEntity(entity);
  }

  public getService<TFacade, TService>(
    type: ScriptServiceCtor<TFacade, TService>,
  ): TFacade {
    return this.context.getService(type);
  }

  public hasComponent(type: Component<object, any[]> | ScriptComponentToken<unknown, object, any[]>): boolean {
    return this.context.hasComponent(type);
  }

  public getComponent<TApi, TEngine extends object>(type: ScriptComponentToken<TApi, TEngine, any[]>): TApi | undefined;
  public getComponent<TComponent extends object>(type: Component<TComponent, any[]>): TComponent | undefined;
  public getComponent(type: Component<object, any[]> | ScriptComponentToken<unknown, object, any[]>): unknown {
    return this.context.getComponent(type as Component<object, any[]>);
  }

  public addComponent<TApi, TEngine extends object, TArgs extends unknown[]>(type: ScriptComponentToken<TApi, TEngine, TArgs>, ...args: TArgs): TApi;
  public addComponent<TComponent extends object, TArgs extends unknown[]>(type: Component<TComponent, TArgs>, ...args: TArgs): TComponent;
  public addComponent(type: Component<object, any[]> | ScriptComponentToken<unknown, object, any[]>, ...args: any[]): unknown {
    return this.context.addComponent(type as Component<object, any[]>, ...args);
  }

  public removeComponent(type: Component<object, any[]> | ScriptComponentToken<unknown, object, any[]>): void {
    this.context.removeComponent(type);
  }

  public requireComponent<TApi, TEngine extends object>(type: ScriptComponentToken<TApi, TEngine, any[]>): TApi;
  public requireComponent<TComponent extends object>(type: Component<TComponent, any[]>): TComponent;
  public requireComponent(type: Component<object, any[]> | ScriptComponentToken<unknown, object, any[]>): unknown {
    const component: unknown = this.getComponent(type as Component<object, any[]>);

    if (component === undefined) {
      const name: string = isScriptComponentToken(type) ? type.engine.name : type.name;
      throw new Error(
        `[AtlasScript] Required component "${name}" is missing on entity "${this.entityId}".`,
      );
    }

    return component;
  }
}
