import { Shader } from "../../core";
import { WebGPUBindingGroupDefinition } from "../bindings";
import { WebGPUReflectedShader, WebGPUReflection } from "../reflect";

import {
  BINDING_GROUP_GLOBAL,
  BINDING_GROUP_OBJECT,
  BINDING_GROUP_MATERIAL,
} from "../web-gpu-const";

export type WebGPUShaderParams = {
  readonly id: string;
  readonly source: string;
  readonly vertexEntryPoint: string;
  readonly fragmentEntryPoint: string;
};

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
    params: WebGPUShaderParams,
    reflected: WebGPUReflectedShader,
  ) {
    this.id = params.id;
    this.source = params.source;
    this.vertexEntryPoint = params.vertexEntryPoint;
    this.fragmentEntryPoint = params.fragmentEntryPoint;
    this.module = shaderModule;

    this.globalDefinition = this.buildDefinition(reflected, BINDING_GROUP_GLOBAL);
    this.objectDefinition = this.buildDefinition(reflected, BINDING_GROUP_OBJECT);
    this.materialDefinition = this.buildDefinition(
      reflected,
      BINDING_GROUP_MATERIAL,
    );
  }

  public destroy(): void {}

  private buildDefinition(
    reflected: WebGPUReflectedShader,
    group: number,
  ): WebGPUBindingGroupDefinition {
    const reflectedGroup =
      reflected.groups.get(group) ?? WebGPUReflection.emptyGroup(group);
    return new WebGPUBindingGroupDefinition(this.id, reflectedGroup);
  }
}
