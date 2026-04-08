import { Color } from "../utils";
import { Node } from "./Node";

export class Shape extends Node {
  public color: Color;

  public constructor() {
    super();
    this.color = new Color(1, 1, 1, 1);
  }

  public setColor(r: number, g: number, b: number, a: number = 1): this {
    this.color.set(r, g, b, a);
    return this;
  }
}
