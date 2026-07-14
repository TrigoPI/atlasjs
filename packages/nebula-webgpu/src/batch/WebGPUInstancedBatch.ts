import { WebGPUShader } from "../material";
import { WebGPUBindingGroup } from "../bindings";
import { WebGPUReflectedStorage } from "../reflect";

import {
  InstancedBatch,
  RenderState,
  BindingValue,
  BindingGroupLayoutHelper,
} from "@atlasjs/nebula";

export abstract class WebGPUInstancedBatch implements InstancedBatch {
  public readonly __kind: string = "webgpu";

  protected readonly shaderRef: WebGPUShader;
  protected readonly storage: WebGPUReflectedStorage;
  protected instanceCount: number;
  protected state: RenderState;

  public constructor(shader: WebGPUShader) {
    const storage: WebGPUReflectedStorage | undefined =
      shader.objectDefinition.storage;

    if (!storage) {
      throw new Error(
        "Instanced shader must declare a storage buffer in group 1.",
      );
    }

    this.shaderRef = shader;
    this.storage = storage;
    this.instanceCount = 0;
    this.state = { blend: "alpha", depthTest: false, cull: "none" };
  }

  public get shader(): WebGPUShader {
    return this.shaderRef;
  }

  public get count(): number {
    return this.instanceCount;
  }

  public get renderState(): RenderState {
    return this.state;
  }

  public get storageBinding(): number {
    return this.storage.binding;
  }

  public get byteSize(): number {
    return this.storage.stride * this.instanceCount;
  }

  public get materialBindings(): WebGPUBindingGroup | undefined {
    return undefined;
  }

  public pack(): ArrayBuffer {
    return BindingGroupLayoutHelper.packStorageArray(
      this.storage.stride,
      this.instanceCount,
      this.storage.members,
      (index: number, name: string): BindingValue => this.valueOf(index, name),
    );
  }

  public destroy(): void {
    this.instanceCount = 0;
  }

  protected abstract valueOf(index: number, name: string): BindingValue;
}
