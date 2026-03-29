import { Mat4 } from "@atlasjs/math";
import { ObjectBinding } from "../../core";
import { WebGPUPipeline } from "../pipeline";
import { BINDING_GROUP_OBJECT } from "../web-gpu-const";
import { WebGPUBindings } from "./WebGPUBidings";

export class WebGPUObjectBindings implements ObjectBinding {
  public readonly bindings: WebGPUBindings;

  public constructor(device: GPUDevice, pipeline: WebGPUPipeline) {
    this.bindings = new WebGPUBindings(device, pipeline);
  }

  public bindVec4At(binding: number): void {
    this.bindings.bindVec4(BINDING_GROUP_OBJECT, binding);
  }

  public setVec4At(binding: number, value: Float32Array): void {
    this.bindings.setFloat32Array(BINDING_GROUP_OBJECT, binding, value);
  }

  public bindMat4At(binding: number): void {
    this.bindings.bindMat4(BINDING_GROUP_OBJECT, binding);
  }

  public setMat4At(binding: number, mat: Mat4): void {
    this.bindings.setMat4(BINDING_GROUP_OBJECT, binding, mat);
  }

  public apply(pass: GPURenderPassEncoder): void {
    this.bindings.apply(pass);
  }

  public destroy(): void {
    this.bindings.destroy();
  }
}
