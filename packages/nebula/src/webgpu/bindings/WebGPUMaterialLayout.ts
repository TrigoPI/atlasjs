import { BindingGroupLayoutHelper } from "../../core/utils";
import { WebGPUBindingGroup } from "./WebGPUBindingGroup";
import { WebGPUBindingGroupDefinition } from "./WebGPUBindingGroupDefinition";

import {
  BindingGroupLayout,
  ResourcePropertyLayout,
  UniformPropertyLayout,
} from "../../core";

/**
 * GPU-facing view of a bind group's layout. Offsets/sizes/bindings come
 * verbatim from the reflected {@link WebGPUBindingGroupDefinition}; this class
 * only derives the `GPUBindGroupLayoutEntry` list and packs values.
 */
export class WebGPUBindingGroupLayout implements BindingGroupLayout {
  public readonly group: number;
  public readonly uniformBinding: number;
  public readonly uniformSize: number;
  public readonly uniformProperties: ReadonlyArray<UniformPropertyLayout>;
  public readonly resourceProperties: ReadonlyArray<ResourcePropertyLayout>;
  public readonly bindGroupLayoutEntries: ReadonlyArray<GPUBindGroupLayoutEntry>;

  public constructor(definition: WebGPUBindingGroupDefinition) {
    this.group = definition.group;
    this.uniformBinding = definition.uniformBinding;
    this.uniformSize = definition.uniformSize;
    this.uniformProperties = definition.uniformProperties;
    this.resourceProperties = definition.resourceProperties;
    this.bindGroupLayoutEntries = this.getBindGroupLayoutEntries();
  }

  public hasUniform(name: string): boolean {
    return this.uniformProperties.some(
      (property: UniformPropertyLayout) => property.name === name,
    );
  }

  public hasResource(name: string): boolean {
    return this.resourceProperties.some(
      (property: ResourcePropertyLayout) => property.name === name,
    );
  }

  public getUniform(name: string): UniformPropertyLayout | undefined {
    return this.uniformProperties.find(
      (property: UniformPropertyLayout) => property.name === name,
    );
  }

  public getResource(name: string): ResourcePropertyLayout | undefined {
    return this.resourceProperties.find(
      (property: ResourcePropertyLayout) => property.name === name,
    );
  }

  public packUniformBuffer(bindings: WebGPUBindingGroup): ArrayBuffer {
    return BindingGroupLayoutHelper.packUniformBuffer(
      this.uniformSize,
      this.uniformProperties,
      (name: string) => bindings.get(name),
    );
  }

  private getBindGroupLayoutEntries(): GPUBindGroupLayoutEntry[] {
    const entries: GPUBindGroupLayoutEntry[] = [];

    if (this.uniformProperties.length > 0) {
      entries.push({
        binding: this.uniformBinding,
        visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT,
        buffer: {
          type: "uniform",
        },
      });
    }

    for (const property of this.resourceProperties) {
      if (property.type === "sampler") {
        entries.push({
          binding: property.binding,
          visibility: GPUShaderStage.FRAGMENT,
          sampler: {},
        });
      } else {
        entries.push({
          binding: property.binding,
          visibility: GPUShaderStage.FRAGMENT,
          texture: {},
        });
      }
    }

    return entries;
  }
}
