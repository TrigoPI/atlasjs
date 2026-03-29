import { ShaderDefinition } from "../../core";
import { WebGPUShader } from "../pipeline";
import { WebGPUShaders } from "../resources/WebGPUShaderList";

export class WebGPUShaderCache {
  private readonly device: GPUDevice;
  private readonly shaders: Map<string, WebGPUShader>;

  public constructor(device: GPUDevice) {
    this.device = device;
    this.shaders = new Map<string, WebGPUShader>();
  }

  public getOrCreate(definition: ShaderDefinition): WebGPUShader {
    const cached: WebGPUShader | undefined = this.shaders.get(definition.id);

    if (!cached) {
      const preludeCode: string = WebGPUShaders.Global.source;
      const userCode: string = definition.source;
      const code: string = `${preludeCode}\n\n${userCode}`;
      const shaderModule: GPUShaderModule = this.device.createShaderModule({
        code,
      });

      const shader: WebGPUShader = new WebGPUShader(shaderModule, definition);
      this.shaders.set(definition.id, shader);

      return shader;
    }

    return cached;
  }

  public clear(): void {
    this.shaders.clear();
  }
}
