import { Shader, ShaderDefinition } from "../../core";

export class WebGPUShader implements Shader {
  public readonly __kind: string = "webgpu";
  public readonly id: string;
  public readonly source: string;

  public readonly vertexEntryPoint: string;
  public readonly fragmentEntryPoint: string;

  public readonly module: GPUShaderModule;

  public constructor(
    shaderModule: GPUShaderModule,
    definition: ShaderDefinition,
  ) {
    this.id = definition.id;
    this.source = definition.source;
    this.vertexEntryPoint = definition.vertexEntryPoint;
    this.fragmentEntryPoint = definition.fragmentEntryPoint;
    this.module = shaderModule;
  }

  public destroy(): void {}
}
