import { Shader, ShaderDescriptor, BindingGroupProperty } from "../../core";
import { WebGPUBindingGroupDefinition } from "../bindings";
import { WebGPUShaderBindingGroups } from "../webgpu-types";

export class WebGPUShader implements Shader {
  public readonly __kind: string = "webgpu";
  public readonly id: string;
  public readonly source: string;

  public readonly vertexEntryPoint: string;
  public readonly fragmentEntryPoint: string;

  public readonly materialDefinition: WebGPUBindingGroupDefinition;
  public readonly objectDefinition: WebGPUBindingGroupDefinition;
  public readonly globalDefinition: WebGPUBindingGroupDefinition;

  public readonly module: GPUShaderModule;

  public constructor(
    shaderModule: GPUShaderModule,
    groups: WebGPUShaderBindingGroups,
    definition: ShaderDescriptor,
  ) {
    this.id = definition.id;
    this.source = definition.source;
    this.vertexEntryPoint = definition.vertexEntryPoint;
    this.fragmentEntryPoint = definition.fragmentEntryPoint;
    this.module = shaderModule;

    this.globalDefinition = new WebGPUBindingGroupDefinition(
      this.id,
      groups.global,
    );

    this.objectDefinition = new WebGPUBindingGroupDefinition(
      this.id,
      groups.object,
    );

    this.materialDefinition = new WebGPUBindingGroupDefinition(
      this.id,
      groups.material,
    );
  }

  public addMaterialProperty(property: BindingGroupProperty): this {
    this.materialDefinition.add(property);
    return this;
  }

  public addObjectProperty(property: BindingGroupProperty): this {
    this.objectDefinition.add(property);
    return this;
  }

  public addGlobalProperty(property: BindingGroupProperty): this {
    this.globalDefinition.add(property);
    return this;
  }

  public destroy(): void {}
}
