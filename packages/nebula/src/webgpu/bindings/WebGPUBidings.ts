import { Mat4 } from "@atlasjs/math";

import { Color } from "../../utils";
import { WebGPUUniformBuffer } from "../buffers";
import { WebGPUPipeline } from "../pipeline";
import { WebGPUSampler, WebGPUTexture2D } from "../resources";
import { UniformKey, UniformGroup } from "../webgpu-types";
import { WebGPUGuard } from "../utils";

import {
  Bindings,
  VertexAttributeFormat,
  Sampler,
  Texture2D,
} from "../../core";

export class WebGPUBindings implements Bindings {
  public readonly __kind: string = "webgpu";
  public readonly pipeline: WebGPUPipeline;

  protected readonly device: GPUDevice;
  protected readonly bindGroups: Map<number, GPUBindGroup>;
  protected readonly uniformBuffers: Map<UniformKey, WebGPUUniformBuffer>;
  protected readonly entriesByGroup: Map<number, UniformGroup>;
  protected readonly dirtyGroups: Set<number>;

  public constructor(device: GPUDevice, pipeline: WebGPUPipeline) {
    this.device = device;
    this.pipeline = pipeline;

    this.bindGroups = new Map<number, GPUBindGroup>();
    this.uniformBuffers = new Map<UniformKey, WebGPUUniformBuffer>();
    this.entriesByGroup = new Map<number, UniformGroup>();
    this.dirtyGroups = new Set<number>();
  }

  public getBindGroup(group: number): GPUBindGroup | undefined {
    return this.bindGroups.get(group);
  }

  public bindUniformBuffer(
    group: number,
    binding: number,
    type: VertexAttributeFormat,
  ): WebGPUUniformBuffer {
    const key: UniformKey = this.createUniformKey(group, binding);
    const existing: WebGPUUniformBuffer | undefined =
      this.uniformBuffers.get(key);

    if (existing) {
      return existing;
    }

    const buffer: WebGPUUniformBuffer = new WebGPUUniformBuffer(
      this.device,
      type,
    );

    this.uniformBuffers.set(key, buffer);
    this.setEntry(group, binding, {
      binding,
      resource: {
        buffer: buffer.buffer,
      },
    });

    return buffer;
  }

  public bindSampler(group: number, binding: number, sampler: Sampler): void {
    const webGPUSampler: WebGPUSampler = WebGPUGuard.asWebGPUSampler(sampler);
    this.setEntry(group, binding, {
      binding,
      resource: webGPUSampler.sampler,
    });
  }

  public bindVec4(group: number, binding: number): void {
    this.bindUniformBuffer(group, binding, "vec4");
  }

  public bindMat4(group: number, binding: number): void {
    this.bindUniformBuffer(group, binding, "mat4");
  }

  public bindColor(group: number, binding: number): void {
    this.bindUniformBuffer(group, binding, "color");
  }

  public bindTexture2D(
    group: number,
    binding: number,
    texture: Texture2D,
  ): void {
    const webGPUTexture: WebGPUTexture2D =
      WebGPUGuard.asWebGPUTexture2D(texture);

    this.setEntry(group, binding, {
      binding,
      resource: webGPUTexture.view,
    });
  }

  public setFloat32Array(
    group: number,
    binding: number,
    data: Float32Array,
  ): void {
    const key: UniformKey = this.createUniformKey(group, binding);
    const buffer: WebGPUUniformBuffer | undefined =
      this.uniformBuffers.get(key);

    if (!buffer) {
      throw new Error(
        `No uniform buffer bound for group=${group}, binding=${binding}.`,
      );
    }

    buffer.setData(data);
  }

  public setColor(group: number, binding: number, color: Color): void {
    const key: UniformKey = this.createUniformKey(group, binding);
    const buffer: WebGPUUniformBuffer | undefined =
      this.uniformBuffers.get(key);

    if (!buffer) {
      throw new Error(
        `No uniform buffer bound for group=${group}, binding=${binding}. Call bindColor() first.`,
      );
    }

    buffer.setData(color.data);
  }

  public setMat4(group: number, binding: number, mat: Mat4): void {
    const key: UniformKey = this.createUniformKey(group, binding);
    const buffer: WebGPUUniformBuffer | undefined =
      this.uniformBuffers.get(key);

    if (!buffer) {
      throw new Error(
        `No uniform buffer bound for group=${group}, binding=${binding}. Call bindMat4() first.`,
      );
    }

    buffer.setData(mat.buffer);
  }

  public apply(pass: GPURenderPassEncoder): void {
    for (const group of this.dirtyGroups) {
      this.rebuildBindGroup(group);
    }

    this.dirtyGroups.clear();

    for (const [group, bindGroup] of this.bindGroups.entries()) {
      pass.setBindGroup(group, bindGroup);
    }
  }

  public destroy(): void {
    for (const uniform of this.uniformBuffers.values()) {
      uniform.destroy();
    }

    this.uniformBuffers.clear();
    this.entriesByGroup.clear();
    this.bindGroups.clear();
    this.dirtyGroups.clear();
  }

  protected createUniformKey(group: number, binding: number): UniformKey {
    return `${group}:${binding}`;
  }

  protected setEntry(
    group: number,
    binding: number,
    entry: GPUBindGroupEntry,
  ): void {
    let groupEntries: UniformGroup | undefined = this.entriesByGroup.get(group);

    if (!groupEntries) {
      groupEntries = new Map<number, GPUBindGroupEntry>();
      this.entriesByGroup.set(group, groupEntries);
    }

    groupEntries.set(binding, entry);
    this.dirtyGroups.add(group);
  }

  protected rebuildBindGroup(group: number): void {
    const groupEntries: UniformGroup | undefined =
      this.entriesByGroup.get(group);

    if (!groupEntries || groupEntries.size === 0) {
      this.bindGroups.delete(group);
      return;
    }

    const entries: GPUBindGroupEntry[] = [...groupEntries.entries()]
      .sort((a, b) => a[0] - b[0])
      .map(([, entry]) => entry);

    const bindGroup: GPUBindGroup = this.device.createBindGroup({
      layout: this.pipeline.pipeline.getBindGroupLayout(group),
      entries,
    });

    this.bindGroups.set(group, bindGroup);
  }
}
