import { Disposable } from "../utils";
import { BindingGroupProperty } from "../core-types";
import { BindingGroupDefinition } from "../bindings";

export interface Shader extends Disposable {
  readonly __kind: string;
  readonly id: string;
  readonly source: string;
  readonly vertexEntryPoint: string;
  readonly fragmentEntryPoint: string;

  readonly materialDefinition: BindingGroupDefinition;
  readonly objectDefinition: BindingGroupDefinition;
  readonly globalDefinition: BindingGroupDefinition;

  addMaterialProperty(property: BindingGroupProperty): this;
  addObjectProperty(property: BindingGroupProperty): this;
  addGlobalProperty(property: BindingGroupProperty): this;
}
