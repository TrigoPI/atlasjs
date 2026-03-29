import { Sampler, SamplerDescriptor, IDGenerator } from "../../core";

export class WebGPUSampler implements Sampler {
  public readonly __kind: string = "webgpu";
  public readonly id: string;
  public readonly sampler: GPUSampler;

  public constructor(device: GPUDevice, descriptor?: SamplerDescriptor) {
    this.id = IDGenerator.createSamplerId(descriptor);
    this.sampler = device.createSampler({
      magFilter: descriptor?.magFilter ?? "linear",
      minFilter: descriptor?.minFilter ?? "linear",
      addressModeU: descriptor?.addressModeU ?? "clamp-to-edge",
      addressModeV: descriptor?.addressModeV ?? "clamp-to-edge",
    });
  }

  public destroy(): void {}
}
