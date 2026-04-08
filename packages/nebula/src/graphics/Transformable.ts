import { Mat4, Transform2D, Vec2 } from "@atlasjs/math";

export class Transformable {
  public readonly worldMatrix: Mat4;
  public readonly transform: Transform2D;

  protected readonly transformMatrix: Mat4;

  private readonly worldPosition: Vec2;

  public constructor() {
    this.transform = new Transform2D();

    this.worldMatrix = Mat4.identity();
    this.transformMatrix = Mat4.identity();
    this.worldPosition = Vec2.create();
  }

  public getWorldPosition(): Vec2 {
    return this.worldPosition;
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
