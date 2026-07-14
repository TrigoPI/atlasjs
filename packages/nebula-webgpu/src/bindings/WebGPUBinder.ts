import { WebGPUVertexBuffer, WebGPUIndexBuffer } from "../buffers";
import { WebGPUGeometry } from "../geometry";
import { WebGPUPipeline } from "../pipeline";
import { WebGPURenderContext } from "../states";

export class WebGPUBinder {
  public bindPipeline(
    context: WebGPURenderContext,
    pipeline: WebGPUPipeline,
  ): void {
    if (context.renderState.pipeline === pipeline) {
      return;
    }

    context.renderPass.setPipeline(pipeline.pipeline);
    context.renderState.pipeline = pipeline;
    context.renderState.shader = pipeline.descriptor.shader;
  }

  public bindVertexBuffer(
    context: WebGPURenderContext,
    vertexBuffer: WebGPUVertexBuffer,
    slot: number = 0,
  ): void {
    if (context.renderState.vertexBuffer === vertexBuffer) {
      return;
    }

    context.renderPass.setVertexBuffer(slot, vertexBuffer.buffer);
    context.renderState.vertexBuffer = vertexBuffer;
  }

  public bindIndexBuffer(
    context: WebGPURenderContext,
    indexBuffer: WebGPUIndexBuffer,
  ): void {
    if (context.renderState.indexBuffer === indexBuffer) {
      return;
    }

    context.renderPass.setIndexBuffer(indexBuffer.buffer, indexBuffer.format);
    context.renderState.indexBuffer = indexBuffer;
  }

  public bindGeometry(
    context: WebGPURenderContext,
    geometry: WebGPUGeometry,
  ): void {
    if (context.renderState.geometry === geometry) {
      return;
    }

    this.bindVertexBuffer(context, geometry.vertexBuffer, 0);
    this.bindIndexBuffer(context, geometry.indexBuffer);
    context.renderState.geometry = geometry;
  }

  public bindGroup(
    context: WebGPURenderContext,
    group: number,
    bindGroup: GPUBindGroup,
  ): void {
    if (context.renderState.bindGroups.get(group) === bindGroup) {
      return;
    }

    context.renderPass.setBindGroup(group, bindGroup);
    context.renderState.bindGroups.set(group, bindGroup);
  }
}
