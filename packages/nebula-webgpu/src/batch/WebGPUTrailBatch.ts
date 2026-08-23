import { Vec2, Vec4 } from "@atlasjs/math";

import { WebGPUInstancedBatch } from "./WebGPUInstancedBatch";

import { TrailBatch, RenderState, BindingValue } from "@atlasjs/nebula";

export class WebGPUTrailBatch
  extends WebGPUInstancedBatch
  implements TrailBatch
{
  private readonly posA: Vec2[] = [];
  private readonly posB: Vec2[] = [];
  private readonly edgeA: Vec2[] = [];
  private readonly edgeB: Vec2[] = [];
  private readonly colorA: Vec4[] = [];
  private readonly colorB: Vec4[] = [];

  public begin(renderState: RenderState): void {
    this.instanceCount = 0;
    this.state = renderState;
  }

  public add(
    posA: Vec2,
    posB: Vec2,
    edgeA: Vec2,
    edgeB: Vec2,
    colorA: Vec4,
    colorB: Vec4,
  ): void {
    this.posA[this.instanceCount] = posA;
    this.posB[this.instanceCount] = posB;
    this.edgeA[this.instanceCount] = edgeA;
    this.edgeB[this.instanceCount] = edgeB;
    this.colorA[this.instanceCount] = colorA;
    this.colorB[this.instanceCount] = colorB;
    this.instanceCount++;
  }

  public override destroy(): void {
    this.posA.length = 0;
    this.posB.length = 0;
    this.edgeA.length = 0;
    this.edgeB.length = 0;
    this.colorA.length = 0;
    this.colorB.length = 0;
    super.destroy();
  }

  protected valueOf(index: number, name: string): BindingValue {
    if (name === "posA") return this.posA[index];
    if (name === "posB") return this.posB[index];
    if (name === "edgeA") return this.edgeA[index];
    if (name === "edgeB") return this.edgeB[index];
    if (name === "colorA") return this.colorA[index];
    return this.colorB[index];
  }
}
