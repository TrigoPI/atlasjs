import { VertexBufferLayout } from "@atlasjs/nebula";
import { WebGPUPipelineDescriptor } from "../webgpu-types";
import { WebGPUGeometry } from "../geometry";
import { WebGPUBlend, WebGPUMapper } from "../utils";

export class WebGPUPipeline {
  public readonly __kind: string = "webgpu";
  public readonly id: string;
  public readonly descriptor: WebGPUPipelineDescriptor;
  public readonly pipeline: GPURenderPipeline;
  public readonly geometry: WebGPUGeometry;

  private readonly bindGroupLayouts: ReadonlyArray<GPUBindGroupLayout>;

  public constructor(device: GPUDevice, descriptor: WebGPUPipelineDescriptor) {
    const layout: VertexBufferLayout = descriptor.geometry.vertexBuffer.layout;
    const webgpuBufferLayout: GPUVertexBufferLayout =
      WebGPUMapper.toGPUVertexBufferLayout(layout);

    this.geometry = descriptor.geometry;
    this.descriptor = descriptor;
    this.bindGroupLayouts = descriptor.bindGroupLayouts ?? [];
    this.id = this.createPipelineId();

    this.pipeline = device.createRenderPipeline({
      layout: descriptor.layout ?? "auto",
      vertex: {
        entryPoint: this.descriptor.shader.vertexEntryPoint,
        module: this.descriptor.shader.module,
        buffers: [webgpuBufferLayout],
      },
      fragment: {
        entryPoint: this.descriptor.shader.fragmentEntryPoint,
        module: this.descriptor.shader.module,
        targets: [
          {
            format: this.descriptor.format,
            blend: WebGPUBlend.toBlendState(descriptor.renderState.blend),
          },
        ],
      },
      primitive: {
        topology: this.descriptor.topology,
        cullMode: descriptor.renderState.cull,
      },
    });
  }

  public destroy(): void {}

  public getBindGroupLayout(index: number): GPUBindGroupLayout {
    return this.bindGroupLayouts[index] ?? this.pipeline.getBindGroupLayout(index);
  }

  private createPipelineId(): string {
    const state: WebGPUPipelineDescriptor["renderState"] =
      this.descriptor.renderState;

    return [
      this.descriptor.shader.id,
      this.descriptor.geometry.vertexBuffer.layout.getId(),
      this.descriptor.format,
      this.descriptor.topology,
      state.blend,
      state.cull,
      state.depthTest ? "d" : "n",
    ].join("|");
  }
}
