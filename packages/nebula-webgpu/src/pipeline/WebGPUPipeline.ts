import { PipelineKeySpec, WebGPUPipelineDescriptor } from "../webgpu-types";
import { WebGPUGeometry } from "../geometry";
import { WebGPUBlend, WebGPUMapper } from "../utils";

export class WebGPUPipeline {
  public readonly __kind: string = "webgpu";
  public readonly descriptor: WebGPUPipelineDescriptor;
  public readonly pipeline: GPURenderPipeline;
  public readonly geometry?: WebGPUGeometry;

  private readonly bindGroupLayouts: ReadonlyArray<GPUBindGroupLayout>;

  public constructor(device: GPUDevice, descriptor: WebGPUPipelineDescriptor) {
    // prettier-ignore
    const buffers: GPUVertexBufferLayout[] = descriptor.geometry
      ? [WebGPUMapper.toGPUVertexBufferLayout(descriptor.geometry.vertexBuffer.layout)]
      : [];

    this.geometry = descriptor.geometry;
    this.descriptor = descriptor;
    this.bindGroupLayouts = descriptor.bindGroupLayouts;

    this.pipeline = device.createRenderPipeline({
      layout: descriptor.layout,
      vertex: {
        entryPoint: this.descriptor.shader.vertexEntryPoint,
        module: this.descriptor.shader.module,
        buffers,
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
    return (
      this.bindGroupLayouts[index] ?? this.pipeline.getBindGroupLayout(index)
    );
  }

  public static computeKey(spec: PipelineKeySpec): string {
    return [
      spec.variant,
      spec.shaderId,
      spec.layoutId ?? "-",
      spec.format,
      spec.blend,
      spec.cull,
      spec.depthTest ? "d" : "n",
      spec.hasMaterial ? "m" : "n",
      spec.topology,
    ].join("|");
  }
}
