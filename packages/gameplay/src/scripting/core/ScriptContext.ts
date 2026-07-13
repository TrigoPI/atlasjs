import { Component, Entity } from "@atlasjs/nexus";

import type { RigidBody2DComponent } from "../components/RigidBody2DComponent";
import type { Transform2DComponent } from "../components/Transform2DComponent";

import { ScriptComponentCtor } from "./ScriptComponent";

export interface ScriptContext {
  readonly transform: Transform2DComponent;
  readonly rigidbody: RigidBody2DComponent;

  getEntityId(): Entity;

  hasComponent<TComponent extends object>(
    type: Component<TComponent, any[]>,
  ): boolean;

  getComponent<TComponent extends object>(
    type: Component<TComponent, any[]>,
  ): TComponent | undefined;

  addComponent<TFacade, TEngine extends object, TArgs extends unknown[]>(
    type: ScriptComponentCtor<TFacade, TEngine, TArgs>,
    ...args: TArgs
  ): TFacade;
  addComponent<TComponent extends object, TArgs extends unknown[]>(
    type: Component<TComponent, TArgs>,
    ...args: TArgs
  ): TComponent;

  removeComponent<TComponent extends object>(
    type: Component<TComponent, any[]>,
  ): void;
}
