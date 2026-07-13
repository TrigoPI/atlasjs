import { Component, Entity } from "@atlasjs/nexus";

import type { RigidBody2DHandle } from "../runtime/RigidBody2DHandle";
import type { Transform2DHandle } from "../runtime/Transform2DHandle";

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

  public get transform(): Transform2DHandle {
    return this.context.transform;
  }

  public get rigidbody(): RigidBody2DHandle {
    return this.context.rigidbody;
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

  public addComponent<TComponent extends object, TArgs extends unknown[]>(
    type: Component<TComponent, TArgs>,
    ...args: TArgs
  ): TComponent {
    return this.context.addComponent(type, ...args);
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
