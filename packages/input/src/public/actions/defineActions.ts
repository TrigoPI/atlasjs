import { ActionKind, AnyActionSpec } from "./bindings";

export type ActionKinds = Record<string, ActionKind>;

export type ActionKindsOf<T extends Record<string, AnyActionSpec>> = {
  [K in keyof T]: T[K]["kind"];
};

export interface ActionMapDescriptor<T extends Record<string, AnyActionSpec>> {
  readonly specs: T;
}

export function defineActions<T extends Record<string, AnyActionSpec>>(
  specs: T,
): ActionMapDescriptor<T> {
  return { specs };
}
