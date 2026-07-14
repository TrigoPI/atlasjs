import { Mat4, Vec4 } from "@atlasjs/math";

import { WebGPUInstancedBatch } from "./WebGPUInstancedBatch";

import { ShapeBatch, RenderState, BindingValue } from "@atlasjs/nebula";

export class WebGPUShapeBatch
  extends WebGPUInstancedBatch
  implements ShapeBatch
{
  private readonly models: Mat4[] = [];
  private readonly colors: Vec4[] = [];
  private readonly params: Vec4[] = [];

  public begin(renderState: RenderState): void {
    this.instanceCount = 0;
    this.state = renderState;
  }

  public add(model: Mat4, color: Vec4, params: Vec4): void {
    this.models[this.instanceCount] = model;
    this.colors[this.instanceCount] = color;
    this.params[this.instanceCount] = params;
    this.instanceCount++;
  }

  public override destroy(): void {
    this.models.length = 0;
    this.colors.length = 0;
    this.params.length = 0;
    super.destroy();
  }

  protected valueOf(index: number, name: string): BindingValue {
    if (name === "model") return this.models[index];
    if (name === "color") return this.colors[index];
    return this.params[index];
  }
}
