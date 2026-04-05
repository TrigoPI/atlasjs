import { Geometry, Primitive } from "../../core";
import { WebGPUVertexBuffer, WebGPUIndexBuffer } from "../buffers";

export class WebGPUGeometry implements Geometry {
  public readonly __kind: string = "webgpu";

  public readonly vertexBuffer: WebGPUVertexBuffer;
  public readonly indexBuffer: WebGPUIndexBuffer;
  public readonly primitive: Primitive;

  constructor(
    primitive: Primitive,
    vertexBuffer: WebGPUVertexBuffer,
    indexBuffer: WebGPUIndexBuffer,
  ) {
    this.vertexBuffer = vertexBuffer;
    this.indexBuffer = indexBuffer;
    this.primitive = primitive;
  }

  public destroy(): void {
    this.vertexBuffer.destroy();
    this.indexBuffer.destroy();
  }
}
