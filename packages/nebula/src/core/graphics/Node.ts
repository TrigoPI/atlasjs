import { Transform2D } from "@atlasjs/math";

export class Node {
  public transform: Transform2D;
  public visible: boolean;

  public constructor() {
    this.transform = new Transform2D();
    this.visible = true;
  }

  public setPosition(x: number, y: number): this {
    this.transform.setPosition(x, y);
    return this;
  }

  public setRotation(angle: number): this {
    this.transform.setRotation(angle);
    return this;
  }

  public setScale(x: number, y: number): this {
    this.transform.setScale(x, y);
    return this;
  }
}
