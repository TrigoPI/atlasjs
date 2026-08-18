import { BlendMode } from "../core";
import { Color } from "../utils";
import { Node } from "./Node";

export class ShapeNode extends Node {
  public color: Color;
  public blend: BlendMode;
  public borderWidth: number;

  public constructor() {
    super();
    this.color = new Color(1, 1, 1, 1);
    this.blend = "alpha";
    this.borderWidth = 0;
  }

  public setColor(r: number, g: number, b: number, a: number = 1): this {
    this.color.set(r, g, b, a);
    return this;
  }

  public setBlend(blend: BlendMode): this {
    this.blend = blend;
    return this;
  }

  public setBorderWidth(width: number): this {
    this.borderWidth = width;
    return this;
  }
}
