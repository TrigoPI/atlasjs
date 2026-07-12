import { Disposable, ShaderDescriptor } from "../../core";
import { WebGPUShader } from "../material";
import { WebGPUShaders } from "../resources";
import { WebGPUReflectedShader, WebGPUReflection } from "../reflect";

export class WebGPUShaderCache implements Disposable {
  private readonly device: GPUDevice;
  private readonly shaders: Map<string, WebGPUShader>;

  public constructor(device: GPUDevice) {
    this.device = device;
    this.shaders = new Map<string, WebGPUShader>();
  }

  public getOrCreate(descriptor: ShaderDescriptor): WebGPUShader {
    const id: string = descriptor.id ?? WebGPUShaderCache.hash(descriptor.source);

    const cached: WebGPUShader | undefined = this.shaders.get(id);
    if (cached) {
      return cached;
    }

    const preludeCode: string = WebGPUShaders.Global.source;
    const code: string = `${preludeCode}\n\n${descriptor.source}`;

    const reflected: WebGPUReflectedShader = WebGPUReflection.reflect(code);
    const shaderModule: GPUShaderModule = this.device.createShaderModule({
      code,
    });

    const shader: WebGPUShader = new WebGPUShader(
      shaderModule,
      {
        id,
        source: descriptor.source,
        vertexEntryPoint:
          descriptor.vertexEntryPoint || reflected.vertexEntryPoint,
        fragmentEntryPoint:
          descriptor.fragmentEntryPoint || reflected.fragmentEntryPoint,
      },
      reflected,
    );

    this.shaders.set(id, shader);
    return shader;
  }

  public destroy(): void {
    this.shaders.clear();
  }

  /** Stable, dependency-free djb2 hash used as a fallback shader id. */
  private static hash(source: string): string {
    let hash: number = 5381;
    for (let i = 0; i < source.length; i++) {
      hash = (hash * 33) ^ source.charCodeAt(i);
    }
    return `atlas.shader.${(hash >>> 0).toString(16)}`;
  }
}
