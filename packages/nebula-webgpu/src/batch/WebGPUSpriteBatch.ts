import { Mat4, Vec4 } from "@atlasjs/math";

import { WebGPUShader } from "../material";
import { WebGPUBindingGroup } from "../bindings";
import { WebGPUReflectedStorage } from "../reflect";

import {
  SpriteBatch,
  Texture2D,
  Sampler,
  RenderState,
  BindingValue,
  BindingGroupLayoutHelper,
} from "@atlasjs/nebula";

export class WebGPUSpriteBatch implements SpriteBatch {
  public readonly __kind: string = "webgpu";
  public readonly materialBindings: WebGPUBindingGroup;

  private readonly storage: WebGPUReflectedStorage;
  private readonly models: Mat4[];
  private readonly uvRects: Vec4[];
  private readonly tints: Vec4[];

  private instanceCount: number;
  private state: RenderState;

  public constructor(shader: WebGPUShader) {
    const storage: WebGPUReflectedStorage | undefined =
      shader.objectDefinition.storage;

    if (!storage) {
      throw new Error(
        "Instanced sprite shader must declare a storage buffer in group 1.",
      );
    }

    this.storage = storage;
    this.materialBindings = new WebGPUBindingGroup(shader.materialDefinition);
    this.models = [];
    this.uvRects = [];
    this.tints = [];
    this.instanceCount = 0;
    this.state = { blend: "alpha", depthTest: false, cull: "none" };
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

  public begin(
    texture: Texture2D,
    sampler: Sampler,
    renderState: RenderState,
  ): void {
    this.instanceCount = 0;
    this.state = renderState;
    this.materialBindings.set("uTexture", texture).set("uSampler", sampler);
  }

  public add(model: Mat4, uvRect: Vec4, tint: Vec4): void {
    this.models[this.instanceCount] = model;
    this.uvRects[this.instanceCount] = uvRect;
    this.tints[this.instanceCount] = tint;
    this.instanceCount++;
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
    this.materialBindings.destroy();
    this.models.length = 0;
    this.uvRects.length = 0;
    this.tints.length = 0;
    this.instanceCount = 0;
  }

  private valueOf(index: number, name: string): BindingValue {
    if (name === "model") return this.models[index];
    if (name === "uvRect") return this.uvRects[index];
    return this.tints[index];
  }
}
