import { BindingGroup } from ".";
import { UniformPropertyLayout, ResourcePropertyLayout } from "../core-types";

export interface BindingGroupLayout {
  readonly group: number;
  readonly uniformBinding: number;
  readonly uniformSize: number;
  readonly uniformProperties: ReadonlyArray<UniformPropertyLayout>;
  readonly resourceProperties: ReadonlyArray<ResourcePropertyLayout>;

  getResource(name: string): ResourcePropertyLayout | undefined;
  getUniform(name: string): UniformPropertyLayout | undefined;
  hasUniform(name: string): boolean;
  hasResource(name: string): boolean;
  packUniformBuffer(bindings: BindingGroup): ArrayBuffer;
}
