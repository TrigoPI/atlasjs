import { Vec2 } from "@atlasjs/math";

export class TransformWriteRequest {
  public hasPosition: boolean;
  public hasRotation: boolean;
  public hasScale: boolean;

  public position: Vec2;
  public rotation: number;
  public scale: Vec2;

  public constructor() {
    this.hasPosition = false;
    this.hasRotation = false;
    this.hasScale = false;

    this.position = new Vec2(0, 0);
    this.rotation = 0;
    this.scale = new Vec2(1, 1);
  }

  public setPosition(x: number, y: number): void {
    this.hasPosition = true;
    this.position.set(x, y);
  }

  public setRotation(rotation: number): void {
    this.hasRotation = true;
    this.rotation = rotation;
  }

  public setScale(x: number, y: number): void {
    this.hasScale = true;
    this.scale.set(x, y);
  }

  public reset(): void {
    this.hasPosition = false;
    this.hasRotation = false;
    this.hasScale = false;
  }
}
