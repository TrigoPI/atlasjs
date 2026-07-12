import { Disposable } from "../utils";
import { BindingValue } from "../core-types";

import { BindingGroupDefinition } from "./BindingGroupDefinition";

export interface BindingGroup extends Disposable {
  readonly __kind: string;
  readonly definition: BindingGroupDefinition;
  readonly version: number;

  has(name: string): boolean;
  get<T extends BindingValue = BindingValue>(name: string): T;

  /**
   * Sets the value of a binding property. The expected type is derived from the
   * property's declaration in the {@link BindingGroupDefinition}; the value is
   * validated against it and the call throws early on a name or type mismatch.
   */
  set(name: string, value: BindingValue): this;

  clone(): BindingGroup;
}
