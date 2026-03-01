import { Bound, Vec2 } from "@atlasjs/math";

import { Node } from "./Node";
import { DirtyQueue } from "../graph";
import { FillStyle, RectData, StrokeStyle } from "./types";

export class RectNode extends Node {
  public override readonly kind: string;
  private data: RectData;

  public constructor(dirty: DirtyQueue<Node>, id?: string) {
    super(dirty, id);
    this.kind = "rect";
    this.data = {
      width: 32,
      height: 32,
      fill: {
        color: 0xffffff,
        alpha: 1,
      },
      stroke: {
        color: 0x000000,
        alpha: 0,
        width: 0,
      },
    };
  }

  public get width(): number {
    return this.data.width;
  }

  public get height(): number {
    return this.data.height;
  }

  public override getLocalBound(): Bound {
    const hw: number = this.data.width * 0.5;
    const hh: number = this.data.height * 0.5;
    return new Bound(-hw, -hh, this.data.width, this.data.height);
  }

  public override hitTestLocal(p: Vec2): boolean {
    const hw: number = this.data.width * 0.5;
    const hh: number = this.data.height * 0.5;
    return p.x >= -hw && p.x <= hw && p.y >= -hh && p.y <= hh;
  }

  public getFill(): FillStyle {
    return { ...this.data.fill };
  }

  public getStroke(): StrokeStyle {
    return { ...this.data.stroke };
  }

  public getFillColor(): number {
    return this.data.fill.color;
  }

  public getFillAlpha(): number {
    return this.data.fill.alpha;
  }

  public getStrokeColor(): number {
    return this.data.stroke.color;
  }

  public getStrokeAlpha(): number {
    return this.data.stroke.alpha;
  }

  public getStrokeWidth(): number {
    return this.data.stroke.width;
  }

  public setSize(w: number, h: number): this {
    this.data.width = w;
    this.data.height = h;
    return this;
  }

  public setFillColor(color: number): this {
    this.data.fill = { ...this.data.fill, color };
    return this;
  }

  public setAlpha(alpha: number): this {
    this.data.fill = { ...this.data.fill, alpha };
    return this;
  }

  public setStrokeColor(color: number): this {
    this.data.stroke = { ...this.data.stroke, color };
    return this;
  }

  public setStrokeWidth(width: number): this {
    this.data.stroke = { ...this.data.stroke, width };
    return this;
  }

  public setStrokeAlpha(alpha: number): this {
    this.data.stroke = { ...this.data.stroke, alpha };
    return this;
  }
}
