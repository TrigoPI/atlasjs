import { BindingValue, Sampler, Texture2D } from "../../core";
import { WebGPUBindingGroup, WebGPUBindingGroupLayout } from "../bindings";
import { WebGPUSampler } from "../resources";
import { WebGPUGuard } from "../utils";

export class WebGPUCompiledBindingGroup {
  private readonly device: GPUDevice;

  public readonly bindingGroupData: WebGPUBindingGroup;
  public readonly layout: WebGPUBindingGroupLayout;
  public readonly bindGroupLayout: GPUBindGroupLayout;

  public bindGroup: GPUBindGroup | null = null;
  public uniformBuffer: GPUBuffer | null = null;
  public version: number = -1;

  public constructor(
    device: GPUDevice,
    bindingGroupData: WebGPUBindingGroup,
    layout: WebGPUBindingGroupLayout,
    bindGroupLayout: GPUBindGroupLayout,
  ) {
    this.device = device;
    this.bindingGroupData = bindingGroupData;
    this.layout = layout;
    this.bindGroupLayout = bindGroupLayout;
  }

  public update(): void {
    if (this.version === this.bindingGroupData.version) {
      return;
    }

    this.updateUniformBuffer();
    this.rebuildBindGroup();
    this.version = this.bindingGroupData.version;
  }

  public destroy(): void {
    this.uniformBuffer?.destroy();
    this.uniformBuffer = null;
    this.bindGroup = null;
    this.version = -1;
  }

  private updateUniformBuffer(): void {
    if (this.layout.uniformSize === 0) {
      return;
    }

    const buffer: ArrayBuffer = this.layout.packUniformBuffer(
      this.bindingGroupData,
    );

    if (!this.uniformBuffer) {
      this.uniformBuffer = this.device.createBuffer({
        size: this.layout.uniformSize,
        usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
      });
    }

    this.device.queue.writeBuffer(this.uniformBuffer, 0, buffer);
  }

  private rebuildBindGroup(): void {
    const entries: GPUBindGroupEntry[] = this.createBindGroupEntries();

    this.bindGroup = this.device.createBindGroup({
      layout: this.bindGroupLayout,
      entries,
    });
  }

  private createBindGroupEntries(): GPUBindGroupEntry[] {
    const entries: GPUBindGroupEntry[] = [];

    if (this.uniformBuffer) {
      entries.push({
        binding: this.layout.uniformBinding,
        resource: {
          buffer: this.uniformBuffer,
        },
      });
    }

    for (const property of this.layout.resourceProperties) {
      const value: BindingValue = this.bindingGroupData.get(property.name);

      if (property.type === "texture2D") {
        const texture = WebGPUGuard.asWebGPUTexture2D(value as Texture2D);

        if (!texture.view) {
          throw new Error(
            `Binding resource "${property.name}" has no GPUTextureView.`,
          );
        }

        entries.push({
          binding: property.binding,
          resource: texture.view,
        });
      } else {
        const sampler: WebGPUSampler = WebGPUGuard.asWebGPUSampler(
          value as Sampler,
        );

        entries.push({
          binding: property.binding,
          resource: sampler.sampler,
        });
      }
    }

    return entries;
  }
}
