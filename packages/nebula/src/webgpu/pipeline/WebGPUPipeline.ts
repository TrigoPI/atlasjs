import { Pipeline } from "../../core";
import { WebGPUMapper } from "../utils";
import { WebGPUPipelineDescriptor } from "../webgpu-types";

export class WebGPUPipeline implements Pipeline {
  public readonly __kind: string = "webgpu";
  public readonly id: string;
  public readonly descriptor: WebGPUPipelineDescriptor;
  public readonly pipeline: GPURenderPipeline;

  public constructor(device: GPUDevice, descriptor: WebGPUPipelineDescriptor) {
    const webgpuBufferLayout: GPUVertexBufferLayout =
      WebGPUMapper.toGPUVertexBufferLayout(descriptor.vertexLayout);

    this.descriptor = descriptor;
    this.id = this.createPipelineId();

    this.pipeline = device.createRenderPipeline({
      layout: "auto",
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
      this.descriptor.vertexLayout.getId(),
      this.descriptor.format,
      this.descriptor.topology,
      this.descriptor.alphaBlend ? "a" : "o",
    ].join("|");
  }
}
