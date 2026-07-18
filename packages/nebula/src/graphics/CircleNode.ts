import { ShapeNode } from "./ShapeNode";

export class CircleNode extends ShapeNode {
  public constructor(radius: number = 50) {
    super();
    this.setRadius(radius);
  }

  public get radius(): number {
    return this.transform.scale.x * 0.5;
  }

  public set radius(r: number) {
    this.transform.setScale(r * 2, r * 2);
  }

  public setRadius(r: number): this {
    this.transform.setScale(r * 2, r * 2);
    return this;
  }
}
