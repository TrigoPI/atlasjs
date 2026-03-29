import { Material } from "../../core";
import { Color } from "../../utils";
import { WebGPUPipeline } from "../pipeline";
import { WebGPUTexture2D, WebGPUSampler } from "../resources";
import { BINDING_GROUP_MATERIAL } from "../web-gpu-const";
import { WebGPUBindings } from "./WebGPUBidings";

export class WebGPUMaterial implements Material {
  public readonly __kind: string = "webgpu";

  public readonly pipeline: WebGPUPipeline;
  public readonly textures: WebGPUTexture2D[];
  public readonly samplers: WebGPUSampler[];

  private readonly bindings: WebGPUBindings;

  public constructor(device: GPUDevice, pipeline: WebGPUPipeline) {
    this.bindings = new WebGPUBindings(device, pipeline);
    this.pipeline = pipeline;
    this.textures = [];
    this.samplers = [];
  }

  public apply(pass: GPURenderPassEncoder): void {
    this.bindings.apply(pass);
  }

  public bindColor(binding: number): void {
    this.bindings.bindColor(BINDING_GROUP_MATERIAL, binding);
  }

  public setColor(binding: number, color: Color): void {
    this.bindings.setColor(BINDING_GROUP_MATERIAL, binding, color);
  }

  public bindSampler(binding: number, sampler: WebGPUSampler): void {
    this.samplers.push(sampler);
    this.bindings.bindSampler(BINDING_GROUP_MATERIAL, binding, sampler);
  }

  public bindTexture2D(binding: number, texture: WebGPUTexture2D): void {
    this.textures.push(texture);
    this.bindings.bindTexture2D(BINDING_GROUP_MATERIAL, binding, texture);
  }

  public destroy(): void {
    this.bindings.destroy();
  }
}
