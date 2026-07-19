import { Mat3, Vec2 } from "@atlasjs/math";

export class WorldTransform2D {
  public readonly matrix: Mat3;

  public constructor() {
    this.matrix = Mat3.identity();
  }

  public getPosition(out?: Vec2): Vec2 {
    return this.matrix.getTranslation(out);
  }

  public getRotation(): number {
    return this.matrix.getRotation();
  }

  public getScale(out?: Vec2): Vec2 {
    return this.matrix.getScale(out);
  }
}
