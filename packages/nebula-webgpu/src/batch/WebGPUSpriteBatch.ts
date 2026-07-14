import { Mat4, Vec4 } from "@atlasjs/math";

import { WebGPUShader } from "../material";
import { WebGPUBindingGroup } from "../bindings";
import { WebGPUInstancedBatch } from "./WebGPUInstancedBatch";

import {
  SpriteBatch,
  Texture2D,
  Sampler,
  RenderState,
  BindingValue,
} from "@atlasjs/nebula";

export class WebGPUSpriteBatch
  extends WebGPUInstancedBatch
  implements SpriteBatch
{
  private readonly materialGroup: WebGPUBindingGroup;
  private readonly models: Mat4[];
  private readonly uvRects: Vec4[];
  private readonly tints: Vec4[];

  public constructor(shader: WebGPUShader) {
    super(shader);
    this.materialGroup = new WebGPUBindingGroup(shader.materialDefinition);
    this.models = [];
    this.uvRects = [];
    this.tints = [];
  }

  public override get materialBindings(): WebGPUBindingGroup {
    return this.materialGroup;
  }

  public begin(
    texture: Texture2D,
    sampler: Sampler,
    renderState: RenderState,
  ): void {
    this.instanceCount = 0;
    this.state = renderState;
    this.materialGroup.set("uTexture", texture).set("uSampler", sampler);
  }

  public add(model: Mat4, uvRect: Vec4, tint: Vec4): void {
    this.models[this.instanceCount] = model;
    this.uvRects[this.instanceCount] = uvRect;
    this.tints[this.instanceCount] = tint;
    this.instanceCount++;
  }

  public override destroy(): void {
    this.materialGroup.destroy();
    this.models.length = 0;
    this.uvRects.length = 0;
    this.tints.length = 0;
    super.destroy();
  }

  protected valueOf(index: number, name: string): BindingValue {
    if (name === "model") return this.models[index];
    if (name === "uvRect") return this.uvRects[index];
    return this.tints[index];
  }
}
