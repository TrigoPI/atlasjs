import { WebGPURenderContextOptions } from "../webgpu-types";
import { WebGPURenderState } from "./WebGPURenderState";

export class WebGPURenderContext {
  public readonly commandEncoder: GPUCommandEncoder;
  public readonly renderPass: GPURenderPassEncoder;
  public readonly textureView: GPUTextureView;
  public readonly renderState: WebGPURenderState;

  public constructor(options: WebGPURenderContextOptions) {
    this.renderState = new WebGPURenderState();
    this.commandEncoder = options.commandEncoder;
    this.renderPass = options.renderPass;
    this.textureView = options.textureView;
  }
}
