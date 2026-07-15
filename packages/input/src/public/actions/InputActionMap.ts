import { Input } from "../Input";

import { ActionKind, AnyActionSpec } from "./bindings";
import { ActionMapDescriptor } from "./defineActions";
import { InputAction } from "./InputAction";
import { ButtonAction } from "./ButtonAction";
import { ValueAction } from "./ValueAction";
import { Vector2Action } from "./Vector2Action";

export type ActionFor<K extends ActionKind> = K extends "button"
  ? ButtonAction
  : K extends "value"
    ? ValueAction
    : K extends "vector2"
      ? Vector2Action
      : never;

function createAction(spec: AnyActionSpec): InputAction {
  switch (spec.kind) {
    case "button":
      return new ButtonAction(spec);
    case "value":
      return new ValueAction(spec);
    case "vector2":
      return new Vector2Action(spec);
  }
}

export class InputActionMap<T extends Record<string, AnyActionSpec>> {
  public enabled: boolean;

  private readonly actions: Map<keyof T, InputAction>;
  private readonly list: InputAction[];

  public constructor(descriptor: ActionMapDescriptor<T>) {
    this.enabled = true;
    this.actions = new Map<keyof T, InputAction>();
    this.list = [];

    const names: (keyof T & string)[] = Object.keys(
      descriptor.specs,
    ) as (keyof T & string)[];

    for (const name of names) {
      const action: InputAction = createAction(descriptor.specs[name]);
      this.actions.set(name, action);
      this.list.push(action);
    }
  }

  public get<K extends keyof T>(name: K): ActionFor<T[K]["kind"]> {
    const action: InputAction | undefined = this.actions.get(name);

    if (action === undefined) {
      throw new Error(`[InputActionMap] Unknown action "${String(name)}".`);
    }

    return action as ActionFor<T[K]["kind"]>;
  }

  public update(input: Input, dt: number): void {
    if (!this.enabled) {
      return;
    }

    for (const action of this.list) {
      action.sample(input, dt);
    }
  }
}
