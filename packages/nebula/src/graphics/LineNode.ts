import { Vec2 } from "@atlasjs/math";
import { ShapeNode } from "./ShapeNode";

export class LineNode extends ShapeNode {
  public readonly start: Vec2;
  public readonly end: Vec2;
  public thickness: number;

  public constructor(
    sx: number = 0,
    sy: number = 0,
    ex: number = 100,
    ey: number = 0,
    thickness: number = 1,
  ) {
    super();
    this.start = new Vec2(sx, sy);
    this.end = new Vec2(ex, ey);
    this.thickness = thickness;
  }

  public setPoints(sx: number, sy: number, ex: number, ey: number): this {
    this.start.set(sx, sy);
    this.end.set(ex, ey);
    return this;
  }

  public setThickness(thickness: number): this {
    this.thickness = thickness;
    return this;
  }
}
