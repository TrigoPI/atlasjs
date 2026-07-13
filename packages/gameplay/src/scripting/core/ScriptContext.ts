import { Component, Entity } from "@atlasjs/nexus";

import type { RigidBody2DHandle } from "../runtime/RigidBody2DHandle";
import type { Transform2DHandle } from "../runtime/Transform2DHandle";

export interface ScriptContext {
  readonly transform: Transform2DHandle;
  readonly rigidbody: RigidBody2DHandle;

  getEntityId(): Entity;
  hasComponent<TComponent extends object>(
    type: Component<TComponent, any[]>,
  ): boolean;

  getComponent<TComponent extends object>(
    type: Component<TComponent, any[]>,
  ): TComponent | undefined;

  addComponent<TComponent extends object, TArgs extends unknown[]>(
    type: Component<TComponent, TArgs>,
    ...args: TArgs
  ): TComponent;

  removeComponent<TComponent extends object>(
    type: Component<TComponent, any[]>,
  ): void;
}
