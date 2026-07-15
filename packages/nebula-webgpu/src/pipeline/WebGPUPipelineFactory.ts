import { RenderState } from "@atlasjs/nebula";

import { WebGPUPipeline } from "./WebGPUPipeline";
import { WebGPUShader } from "../material";
import { WebGPUGeometry } from "../geometry";
import { WebGPUBindingGroupCache } from "../caches";

export class WebGPUPipelineFactory {
  private readonly device: GPUDevice;
  private readonly bindingGroupCache: WebGPUBindingGroupCache;
  private readonly pipelines: Map<string, WebGPUPipeline>;
  private readonly storageLayouts: Map<number, GPUBindGroupLayout>;

  public constructor(
    device: GPUDevice,
    bindingGroupCache: WebGPUBindingGroupCache,
  ) {
    this.device = device;
    this.bindingGroupCache = bindingGroupCache;
    this.pipelines = new Map<string, WebGPUPipeline>();
    this.storageLayouts = new Map<number, GPUBindGroupLayout>();
  }

  public getIndexed(
    shader: WebGPUShader,
    geometry: WebGPUGeometry,
    renderState: RenderState,
    format: GPUTextureFormat,
  ): WebGPUPipeline {
    const topology: GPUPrimitiveTopology = "triangle-list";

    const key: string = WebGPUPipeline.computeKey({
      variant: "indexed",
      shaderId: shader.id,
      format,
      blend: renderState.blend,
      cull: renderState.cull,
      depthTest: renderState.depthTest,
      topology,
      layoutId: geometry.vertexBuffer.layout.getId(),
    });

    return this.getOrCreate(key, () => {
      const globalGroup: GPUBindGroupLayout =
        this.bindingGroupCache.getOrCreateGPULayout(shader.globalDefinition);

      const objectGroup: GPUBindGroupLayout =
        this.bindingGroupCache.getOrCreateGPULayout(shader.objectDefinition);

      const materialGroup: GPUBindGroupLayout =
        this.bindingGroupCache.getOrCreateGPULayout(shader.materialDefinition);

      const bindGroupLayouts: GPUBindGroupLayout[] = [
        globalGroup,
        objectGroup,
        materialGroup,
      ];

      const layout: GPUPipelineLayout = this.device.createPipelineLayout({
        bindGroupLayouts,
      });

      return new WebGPUPipeline(this.device, {
        variant: "indexed",
        topology,
        layout,
        bindGroupLayouts,
        renderState,
        format,
        geometry,
        shader,
      });
    });
  }

  public getInstanced(
    shader: WebGPUShader,
    renderState: RenderState,
    format: GPUTextureFormat,
    hasMaterial: boolean,
  ): WebGPUPipeline {
    const topology: GPUPrimitiveTopology = "triangle-list";

    const key: string = WebGPUPipeline.computeKey({
      variant: "instanced",
      shaderId: shader.id,
      format,
      blend: renderState.blend,
      cull: renderState.cull,
      depthTest: renderState.depthTest,
      topology,
      hasMaterial,
    });

    return this.getOrCreate(key, () => {
      const globalLayout: GPUBindGroupLayout =
        this.bindingGroupCache.getOrCreateGPULayout(shader.globalDefinition);

      const storageLayout: GPUBindGroupLayout = this.getStorageLayout(shader);

      const bindGroupLayouts: GPUBindGroupLayout[] = [
        globalLayout,
        storageLayout,
      ];

      if (hasMaterial) {
        bindGroupLayouts.push(
          this.bindingGroupCache.getOrCreateGPULayout(shader.materialDefinition),
        );
      }

      const layout: GPUPipelineLayout = this.device.createPipelineLayout({
        bindGroupLayouts,
      });

      return new WebGPUPipeline(this.device, {
        variant: "instanced",
        topology,
        layout,
        bindGroupLayouts,
        renderState,
        format,
        shader,
      });
    });
  }

  public getStorageLayout(shader: WebGPUShader): GPUBindGroupLayout {
    const binding: number = shader.objectDefinition.storage?.binding ?? 0;
    let layout: GPUBindGroupLayout | undefined = this.storageLayouts.get(binding);

    if (!layout) {
      layout = this.device.createBindGroupLayout({
        entries: [
          {
            binding,
            visibility: GPUShaderStage.VERTEX,
            buffer: { type: "read-only-storage" },
          },
        ],
      });
      this.storageLayouts.set(binding, layout);
    }

    return layout;
  }

  public destroy(): void {
    for (const pipeline of this.pipelines.values()) {
      pipeline.destroy();
    }

    this.pipelines.clear();
    this.storageLayouts.clear();
  }

  private getOrCreate(
    key: string,
    create: () => WebGPUPipeline,
  ): WebGPUPipeline {
    let pipeline: WebGPUPipeline | undefined = this.pipelines.get(key);

    if (!pipeline) {
      pipeline = create();
      this.pipelines.set(key, pipeline);
    }

    return pipeline;
  }
}
