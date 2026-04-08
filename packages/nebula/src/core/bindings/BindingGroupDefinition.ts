import { BindingGroupProperty } from "../core-types";
import { Disposable } from "../utils";

export interface BindingGroupDefinition extends Disposable {
  readonly __kind: string;
  readonly id: string;
  readonly group: number;

  getProperties(): ReadonlyArray<BindingGroupProperty>;

  has(name: string): boolean;
  add(property: BindingGroupProperty): void;
  get(name: string): BindingGroupProperty | undefined;
}
