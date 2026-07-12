import { BindingValue, Sampler, Texture2D } from "@atlasjs/nebula";
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
  public resourceVersion: number = -1;

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
    const data: WebGPUBindingGroup = this.bindingGroupData;

    // Uniform values changed → re-upload the buffer (the GPUBuffer itself is
    // stable, so this does not require rebuilding the bind group).
    if (this.version !== data.version) {
      this.updateUniformBuffer();
      this.version = data.version;
    }

    // Only rebuild the bind group when a resource reference changed (or on
    // first use) — not on every uniform tweak.
    if (this.bindGroup === null || this.resourceVersion !== data.resourceVersion) {
      this.rebuildBindGroup();
      this.resourceVersion = data.resourceVersion;
    }
  }

  public destroy(): void {
    this.uniformBuffer?.destroy();
    this.uniformBuffer = null;
    this.bindGroup = null;
    this.version = -1;
    this.resourceVersion = -1;
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
