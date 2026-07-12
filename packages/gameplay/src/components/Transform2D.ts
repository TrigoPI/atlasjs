import { Vec2 } from "@atlasjs/math";

export class Transform2D {
  public position: Vec2;
  public scale: Vec2;
  public rotation: number;

  constructor() {
    this.position = new Vec2(0, 0);
    this.scale = new Vec2(1, 1);
    this.rotation = 0;
  }
}
