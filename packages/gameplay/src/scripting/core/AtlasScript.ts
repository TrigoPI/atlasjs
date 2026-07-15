import { Component, Entity } from "@atlasjs/nexus";

import { ScriptComponentCtor } from "./ScriptComponent";
import { ScriptServiceCtor } from "./ScriptService";
import { ScriptContext } from "./ScriptContext";
import { ScriptLifecycle } from "./ScriptLifeCycle";

// prettier-ignore
export abstract class AtlasScript implements ScriptLifecycle {
  private __context?: ScriptContext;

  public onCreate?(): void;
  public onUpdate?(dt: number): void;
  public onFixedUpdate?(): void;
  public onDestroy?(): void;

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

  public getService<TFacade, TService>(
    type: ScriptServiceCtor<TFacade, TService>,
  ): TFacade {
    return this.context.getService(type);
  }

  public hasComponent<TComponent extends object>(
    type: Component<TComponent, any[]>,
  ): boolean {
    return this.context.hasComponent(type);
  }

  public getComponent<TComponent extends object>(
    type: Component<TComponent, any[]>,
  ): TComponent | undefined {
    return this.context.getComponent(type);
  }

  public addComponent<TFacade, TEngine extends object, TArgs extends unknown[]>(type: ScriptComponentCtor<TFacade, TEngine, TArgs>, ...args: TArgs): TFacade;
  public addComponent<TComponent extends object, TArgs extends unknown[]>(type: Component<TComponent, TArgs>, ...args: TArgs): TComponent;
  public addComponent<TComponent extends object, TArgs extends unknown[]>(type: Component<TComponent, TArgs> | ScriptComponentCtor<TComponent, object, TArgs>, ...args: TArgs): TComponent {
    return this.context.addComponent(
      type as Component<TComponent, TArgs>,
      ...args,
    );
  }

  public removeComponent<TComponent extends object>(
    type: Component<TComponent, any[]>,
  ): void {
    this.context.removeComponent(type);
  }

  public requireComponent<TComponent extends object>(
    type: Component<TComponent, any[]>,
  ): TComponent {
    const component: TComponent | undefined = this.getComponent(type);

    if (component === undefined) {
      throw new Error(
        `[AtlasScript] Required component "${type.name}" is missing on entity "${this.entityId}".`,
      );
    }

    return component;
  }
}
