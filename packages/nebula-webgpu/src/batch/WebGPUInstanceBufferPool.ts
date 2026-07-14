import { Disposable } from "@atlasjs/nebula";

type InstanceBufferSlot = {
  buffer: GPUBuffer;
  bindGroup: GPUBindGroup;
  capacity: number;
};

const MIN_CAPACITY: number = 1024;

export class WebGPUInstanceBufferPool implements Disposable {
  private readonly device: GPUDevice;
  private readonly slots: InstanceBufferSlot[];

  private index: number;

  public constructor(device: GPUDevice) {
    this.device = device;
    this.slots = [];
    this.index = 0;
  }

  public reset(): void {
    this.index = 0;
  }

  public acquire(
    data: ArrayBuffer,
    byteSize: number,
    binding: number,
    layout: GPUBindGroupLayout,
  ): GPUBindGroup {
    const slot: InstanceBufferSlot = this.getSlot(byteSize, binding, layout);
    this.device.queue.writeBuffer(slot.buffer, 0, data, 0, byteSize);
    this.index++;
    return slot.bindGroup;
  }

  public destroy(): void {
    for (const slot of this.slots) {
      slot.buffer.destroy();
    }

    this.slots.length = 0;
    this.index = 0;
  }

  private getSlot(
    byteSize: number,
    binding: number,
    layout: GPUBindGroupLayout,
  ): InstanceBufferSlot {
    const existing: InstanceBufferSlot | undefined = this.slots[this.index];

    if (existing && existing.capacity >= byteSize) {
      return existing;
    }

    existing?.buffer.destroy();

    const capacity: number = Math.max(
      byteSize,
      existing ? existing.capacity * 2 : MIN_CAPACITY,
    );

    const buffer: GPUBuffer = this.device.createBuffer({
      size: capacity,
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
    });

    const bindGroup: GPUBindGroup = this.device.createBindGroup({
      layout,
      entries: [{ binding, resource: { buffer } }],
    });

    const slot: InstanceBufferSlot = { buffer, bindGroup, capacity };
    this.slots[this.index] = slot;

    return slot;
  }
}
