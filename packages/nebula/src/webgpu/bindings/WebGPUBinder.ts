import { WebGPUVertexBuffer, WebGPUIndexBuffer } from "../buffers";
import { WebGPUGeometry } from "../geometry";
import { WebGPUPipeline } from "../pipeline";
import { WebGPURenderContext } from "../states";
import { WebGPUBindings } from "./WebGPUBidings";
import { WebGPUMaterial } from "./WebGPUMaterial";

export class WebGPUBinder {
  public bindMaterial(
    context: WebGPURenderContext,
    material: WebGPUMaterial,
  ): void {
    material.apply(context.renderPass);
    context.renderState.material = material;
  }

  public bindObject(
    context: WebGPURenderContext,
    object: WebGPUBindings,
  ): void {
    object.apply(context.renderPass);
    context.renderState.objectBindings = object;
  }

  public bindPipeline(
    context: WebGPURenderContext,
    pipeline: WebGPUPipeline,
  ): void {
    context.renderPass.setPipeline(pipeline.pipeline);
    context.renderState.pipeline = pipeline;
    context.renderState.shader = pipeline.descriptor.shader;
  }

  public bindVertexBuffer(
    context: WebGPURenderContext,
    vertexBuffer: WebGPUVertexBuffer,
    slot: number = 0,
  ): void {
    context.renderPass.setVertexBuffer(slot, vertexBuffer.buffer);
    context.renderState.vertexBuffer = vertexBuffer;
  }

  public bindIndexBuffer(
    context: WebGPURenderContext,
    indexBuffer: WebGPUIndexBuffer,
  ): void {
    context.renderPass.setIndexBuffer(indexBuffer.buffer, indexBuffer.format);
    context.renderState.indexBuffer = indexBuffer;
  }

  public bindGeometry(
    context: WebGPURenderContext,
    geometry: WebGPUGeometry,
  ): void {
    this.bindVertexBuffer(context, geometry.vertexBuffer, 0);
    this.bindIndexBuffer(context, geometry.indexBuffer);
    context.renderState.geometry = geometry;
  }

  public bindGroup(
    context: WebGPURenderContext,
    group: number,
    bindGroup: GPUBindGroup,
  ): void {
    context.renderPass.setBindGroup(group, bindGroup);
    context.renderState.bindGroups.set(group, bindGroup);
  }
}
