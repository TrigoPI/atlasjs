import { Disposable } from "../utils";
import { BindingValue, RenderState } from "../core-types";
import { BindingGroup } from "../bindings";

import { Shader } from "./Shader";

export interface Material extends Disposable {
  readonly __kind: string;
  readonly shader: Shader;
  readonly bindingGroup: BindingGroup;
  readonly renderState: RenderState;

  has(name: string): boolean;
  get<T extends BindingValue = BindingValue>(name: string): T;

  /**
   * Sets the value of a material property. The expected type is derived from the
   * shader's material definition; the value is validated against it and the call
   * throws early on a name or type mismatch.
   */
  set(name: string, value: BindingValue): this;

  clone(): Material;
}
