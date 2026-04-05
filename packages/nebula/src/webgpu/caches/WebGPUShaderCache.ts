import { Disposable, ShaderDescriptor } from "../../core";
import { WebGPUShaderBindingGroups } from "../webgpu-types";
import { WebGPUShader } from "../material";
import { WebGPUShaders } from "../resources";

export class WebGPUShaderCache implements Disposable {
  private readonly device: GPUDevice;
  private readonly shaders: Map<string, WebGPUShader>;
  private readonly groups: WebGPUShaderBindingGroups;

  public constructor(device: GPUDevice, groups: WebGPUShaderBindingGroups) {
    this.device = device;
    this.groups = groups;
    this.shaders = new Map<string, WebGPUShader>();
  }

  public getOrCreate(definition: ShaderDescriptor): WebGPUShader {
    const cached: WebGPUShader | undefined = this.shaders.get(definition.id);

    if (!cached) {
      const preludeCode: string = WebGPUShaders.Global.source;
      const userCode: string = definition.source;
      const code: string = `${preludeCode}\n\n${userCode}`;
      const shaderModule: GPUShaderModule = this.device.createShaderModule({
        code,
      });

      const shader: WebGPUShader = new WebGPUShader(
        shaderModule,
        this.groups,
        definition,
      );

      this.shaders.set(definition.id, shader);
      return shader;
    }

    return cached;
  }

  public destroy(): void {
    this.shaders.clear();
  }
}
