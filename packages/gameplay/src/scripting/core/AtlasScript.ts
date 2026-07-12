import { Entity } from "@atlasjs/nexus";

import { ScriptComponentConstructor } from "./core-types";
import { ScriptContext } from "./ScriptContext";
import { ScriptLifecycle } from "./ScriptLifeCycle";

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

  public hasComponent<TComponent extends object>(
    type: ScriptComponentConstructor<TComponent>,
  ): boolean {
    return this.context.hasComponent(type);
  }

  public getComponent<TComponent extends object>(
    type: ScriptComponentConstructor<TComponent>,
  ): TComponent | null {
    return this.context.getComponent(type);
  }

  public addComponent<TComponent extends object, TArgs extends unknown[]>(
    type: ScriptComponentConstructor<TComponent, TArgs>,
    ...args: TArgs
  ): TComponent {
    return this.context.addComponent(type, ...args);
  }

  public removeComponent<TComponent extends object>(
    type: ScriptComponentConstructor<TComponent>,
  ): void {
    this.context.removeComponent(type);
  }

  public requireComponent<TComponent extends object>(
    type: ScriptComponentConstructor<TComponent>,
  ): TComponent {
    const component = this.getComponent(type);

    if (!component) {
      throw new Error(
        `[AtlasScript] Required component "${type.name}" is missing on entity "${this.entityId}".`,
      );
    }

    return component;
  }
}
