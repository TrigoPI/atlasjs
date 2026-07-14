import { Mat4, ObservableTransform2D, Vec2 } from "@atlasjs/math";
import { Observable } from "@atlasjs/utils";

export class Transformable {
  public readonly worldMatrix: Mat4;
  public readonly transform: ObservableTransform2D;

  protected readonly transformMatrix: Mat4;
  protected localDirty: boolean = true;

  private readonly worldPosition: Vec2;

  public constructor() {
    const observer: Observable = Observable.from(() => {
      this.localDirty = true;
    });

    this.transform = new ObservableTransform2D(observer);

    this.worldMatrix = Mat4.identity();
    this.transformMatrix = Mat4.identity();
    this.worldPosition = Vec2.create();
  }

  public markDirty(): void {
    this.localDirty = true;
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
