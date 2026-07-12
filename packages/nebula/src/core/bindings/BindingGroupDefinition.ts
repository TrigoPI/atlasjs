import { BindingGroupProperty } from "../core-types";
import { Disposable } from "../utils";

/**
 * The set of binding properties of a single group. Derived from shader
 * reflection and treated as read-only — there is no manual `add`.
 */
export interface BindingGroupDefinition extends Disposable {
  readonly __kind: string;
  readonly id: string;
  readonly group: number;

  getProperties(): ReadonlyArray<BindingGroupProperty>;

  has(name: string): boolean;
  get(name: string): BindingGroupProperty | undefined;
}
