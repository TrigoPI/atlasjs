import { Pipeline, VertexBufferLayout } from "@atlasjs/nebula";
import { WebGPUPipelineDescriptor } from "../webgpu-types";
import { WebGPUGeometry } from "../geometry";
import { WebGPUMapper } from "../utils";

export class WebGPUPipeline implements Pipeline {
  public readonly __kind: string = "webgpu";
  public readonly id: string;
  public readonly descriptor: WebGPUPipelineDescriptor;
  public readonly pipeline: GPURenderPipeline;
  public readonly geometry: WebGPUGeometry;

  public constructor(device: GPUDevice, descriptor: WebGPUPipelineDescriptor) {
    const layout: VertexBufferLayout = descriptor.geometry.vertexBuffer.layout;
    const webgpuBufferLayout: GPUVertexBufferLayout =
      WebGPUMapper.toGPUVertexBufferLayout(layout);

    this.geometry = descriptor.geometry;
    this.descriptor = descriptor;
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
            blend: this.getBlend(descriptor),
          },
        ],
      },
      primitive: { topology: this.descriptor.topology },
    });
  }

  public destroy(): void {}

  public getBindGroupLayout(index: number): GPUBindGroupLayout {
    return this.pipeline.getBindGroupLayout(index);
  }

  private getBlend(
    descriptor: WebGPUPipelineDescriptor,
  ): GPUBlendState | undefined {
    return descriptor.alphaBlend
      ? {
          color: {
            srcFactor: "src-alpha",
            dstFactor: "one-minus-src-alpha",
            operation: "add",
          },
          alpha: {
            srcFactor: "one",
            dstFactor: "one-minus-src-alpha",
            operation: "add",
          },
        }
      : undefined;
  }

  private createPipelineId(): string {
    return [
      this.descriptor.shader.id,
      this.descriptor.geometry.vertexBuffer.layout.getId(),
      this.descriptor.format,
      this.descriptor.topology,
      this.descriptor.alphaBlend ? "a" : "o",
    ].join("|");
  }
}
