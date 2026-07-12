import { Disposable } from "../utils";
import { BindingGroupDefinition } from "../bindings";

/**
 * A compiled shader. All binding metadata (groups, bindings, struct layouts,
 * entry points) is derived from the WGSL source via reflection — the source is
 * the single point of truth. There is no manual property-declaration builder.
 */
export interface Shader extends Disposable {
  readonly __kind: string;
  readonly id: string;
  readonly source: string;
  readonly vertexEntryPoint: string;
  readonly fragmentEntryPoint: string;

  readonly materialDefinition: BindingGroupDefinition;
  readonly objectDefinition: BindingGroupDefinition;
  readonly globalDefinition: BindingGroupDefinition;
}
