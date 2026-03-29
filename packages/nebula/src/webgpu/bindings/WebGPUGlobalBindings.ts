import { Mat4 } from "@atlasjs/math";
import { VertexAttributeFormat } from "../../core";
import { WebGPUUniformBuffer } from "../buffers";
import { WebGPUPipeline } from "../pipeline";
import { BINDING_GROUP_GLOBAL } from "../web-gpu-const";

export class WebGPUGlobalBindings {
  private readonly device: GPUDevice;
  private readonly group: number;
  private readonly uniforms: Map<string, WebGPUUniformBuffer>;
  private readonly entries: Map<number, GPUBindGroupEntry>;
  private readonly bindGroups: WeakMap<WebGPUPipeline, GPUBindGroup>;

  public constructor(device: GPUDevice, group: number = BINDING_GROUP_GLOBAL) {
    this.device = device;
    this.group = group;
    this.uniforms = new Map<string, WebGPUUniformBuffer>();
    this.entries = new Map<number, GPUBindGroupEntry>();
    this.bindGroups = new WeakMap<WebGPUPipeline, GPUBindGroup>();
  }

  public bindUniform(
    name: string,
    binding: number,
    type: VertexAttributeFormat,
  ): WebGPUUniformBuffer {
    const existing: WebGPUUniformBuffer | undefined = this.uniforms.get(name);

    if (existing) {
      return existing;
    }

    const uniform: WebGPUUniformBuffer = new WebGPUUniformBuffer(
      this.device,
      type,
    );

    this.uniforms.set(name, uniform);
    this.entries.set(binding, {
      binding,
      resource: {
        buffer: uniform.buffer,
      },
    });

    return uniform;
  }

  public setMat4(name: string, mat: Mat4): void {
    const uniform: WebGPUUniformBuffer | undefined = this.uniforms.get(name);

    if (!uniform) {
      throw new Error(`Global uniform '${name}' is not bound.`);
    }

    uniform.setData(mat.buffer);
  }

  public getBindGroup(pipeline: WebGPUPipeline): GPUBindGroup {
    let bindGroup: GPUBindGroup | undefined = this.bindGroups.get(pipeline);

    if (!bindGroup) {
      const entries = [...this.entries.entries()]
        .sort((a, b) => a[0] - b[0])
        .map(([, entry]) => entry);

      bindGroup = this.device.createBindGroup({
        layout: pipeline.pipeline.getBindGroupLayout(this.group),
        entries,
      });

      this.bindGroups.set(pipeline, bindGroup);
    }

    return bindGroup;
  }

  public destroy(): void {
    for (const uniform of this.uniforms.values()) {
      uniform.destroy();
    }

    this.uniforms.clear();
    this.entries.clear();
  }
}
