import { IndexBuffer, IndexFormat } from "../../core";

export class WebGPUIndexBuffer implements IndexBuffer {
  public readonly __kind: string = "webgpu";

  public readonly size: number;
  public readonly count: number;
  public readonly format: IndexFormat;

  public readonly data: Uint16Array | Uint32Array;
  public readonly buffer: GPUBuffer;

  private readonly device: GPUDevice;

  public constructor(
    device: GPUDevice,
    buffer: Uint16Array | Uint32Array,
    format: IndexFormat,
  ) {
    this.data = buffer;
    this.format = format;
    this.device = device;

    this.count = buffer.length;
    this.size = buffer.byteLength;

    this.buffer = this.device.createBuffer({
      size: this.size,
      label: "index-buffer",
      usage: GPUBufferUsage.INDEX | GPUBufferUsage.COPY_DST,
    });

    this.device.queue.writeBuffer(
      this.buffer,
      0,
      this.data.buffer,
      this.data.byteOffset,
      this.data.byteLength,
    );
  }

  public destroy(): void {
    this.buffer.destroy();
  }
}
