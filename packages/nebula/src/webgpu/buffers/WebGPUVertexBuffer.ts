import { VertexBuffer, VertexBufferLayout } from "../../core";

export class WebGPUVertexBuffer implements VertexBuffer {
  public readonly __kind: string = "webgpu";

  public readonly layout: VertexBufferLayout;
  public readonly data: Float32Array;
  public readonly buffer: GPUBuffer;

  public constructor(
    device: GPUDevice,
    buffer: Float32Array,
    layout: VertexBufferLayout,
  ) {
    this.data = buffer;
    this.layout = layout;

    this.buffer = device.createBuffer({
      label: "vertex-buffer",
      size: this.data.byteLength,
      usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
    });

    device.queue.writeBuffer(
      this.buffer,
      0,
      this.data.buffer,
      this.data.byteOffset,
      this.data.byteLength,
    );
  }

  public getSize(): number {
    return this.data.byteLength;
  }

  public getStride(): number {
    return this.layout.getStride();
  }

  public destroy(): void {
    this.buffer.destroy();
  }
}
