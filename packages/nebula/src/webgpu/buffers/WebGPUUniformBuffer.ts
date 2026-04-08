import { SHADER_PROPERTY_SIZES, UniformBuffer, UniformType } from "../../core";

export class WebGPUUniformBuffer implements UniformBuffer {
  public readonly __kind: string = "webgpu";
  public readonly buffer: GPUBuffer;
  public readonly size: number;
  public readonly device: GPUDevice;

  constructor(device: GPUDevice, type: UniformType) {
    this.size = SHADER_PROPERTY_SIZES[type];
    this.device = device;
    this.buffer = this.device.createBuffer({
      size: this.size,
      label: "uniform-buffer",
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });
  }

  public setData(data: Float32Array): void {
    if (data.byteLength > this.size) {
      throw new Error("Data exceeds uniform buffer size");
    }

    this.device.queue.writeBuffer(
      this.buffer,
      0,
      data.buffer,
      data.byteOffset,
      data.byteLength,
    );
  }

  public destroy(): void {
    this.buffer.destroy();
  }
}
