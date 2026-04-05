import { GetUniformPropertiesResult } from "../webgpu-types";
import { BindingGroupLayoutHelper } from "../../core/utils";
import { WebGPUBindingGroup } from "./WebGPUBindingGroup";

import {
  BindingGroupDefinition,
  BindingGroupLayout,
  ResourcePropertyLayout,
  ResourcePropertyType,
  TypeLayoutInfo,
  UniformPropertyLayout,
  UniformType,
} from "../../core";

export class WebGPUBindingGroupLayout implements BindingGroupLayout {
  public readonly group: number;
  public readonly uniformBinding: number;
  public readonly uniformSize: number;
  public readonly uniformProperties: ReadonlyArray<UniformPropertyLayout>;
  public readonly resourceProperties: ReadonlyArray<ResourcePropertyLayout>;
  public readonly bindGroupLayoutEntries: ReadonlyArray<GPUBindGroupLayoutEntry>;

  public constructor(
    definition: BindingGroupDefinition,
    uniformBinding: number = 0,
  ) {
    this.group = definition.group;
    this.uniformBinding = uniformBinding;

    const { layout, size } = this.getUniformProperties(definition);

    this.uniformProperties = layout;
    this.uniformSize = size;

    this.resourceProperties = this.getResourceProperties(definition);
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

  private getUniformProperties(
    definition: BindingGroupDefinition,
  ): GetUniformPropertiesResult {
    const result: UniformPropertyLayout[] = [];

    let currentOffset: number = 0;
    let maxAlign: number = 1;

    for (const property of definition.getProperties()) {
      if (!BindingGroupLayoutHelper.isResourceType(property.type)) {
        const layoutInfo: TypeLayoutInfo =
          BindingGroupLayoutHelper.getTypeLayoutInfo(property);

        maxAlign = Math.max(maxAlign, layoutInfo.align);
        currentOffset = BindingGroupLayoutHelper.alignTo(
          currentOffset,
          layoutInfo.align,
        );

        result.push({
          offset: currentOffset,
          name: property.name,
          type: property.type as UniformType,
          align: layoutInfo.align,
          size: layoutInfo.size,
        });

        currentOffset += layoutInfo.size;
      }
    }

    const size: number =
      result.length > 0
        ? BindingGroupLayoutHelper.alignTo(currentOffset, maxAlign)
        : 0;

    return {
      size,
      layout: result,
    };
  }

  private getResourceProperties(
    definition: BindingGroupDefinition,
  ): ResourcePropertyLayout[] {
    const result: ResourcePropertyLayout[] = [];
    let nextBinding: number = this.uniformBinding + 1;

    for (const property of definition.getProperties()) {
      if (BindingGroupLayoutHelper.isResourceType(property.type)) {
        result.push({
          binding: nextBinding,
          type: property.type as ResourcePropertyType,
          name: property.name,
        });

        nextBinding++;
      }
    }

    return result;
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
