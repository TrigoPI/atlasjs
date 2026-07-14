import { Mat4, Vec2 } from "@atlasjs/math";

import { Camera } from "./Camera";

//prettier-ignore
export class Camera2D implements Camera {
  public readonly view: Mat4;
  public readonly projection: Mat4;
  public readonly viewProjection: Mat4;

  public readonly position: Vec2;
  public zoom: number;

  public constructor() {
    this.view = Mat4.identity();
    this.projection = Mat4.identity();
    this.viewProjection = Mat4.identity();
    this.position = Vec2.create();
    this.zoom = 1;
  }

  public setPosition(x: number, y: number): Camera2D {
    this.position.set(x, y);
    return this;
  }

  public setZoom(zoom: number): Camera2D {
    this.zoom = zoom;
    return this;
  }

  public move(x: number, y: number): Camera2D {
    this.position.x += x;
    this.position.y += y;
    return this;
  }

  public update(width: number, height: number): void {
    this.projection
      .identity()
      .orthographic(0, width, height, 0, -1, 1);

    this.view
      .identity()
      .scale(this.zoom, this.zoom, 1)
      .translate(-this.position.x, -this.position.y, 0);

    this.viewProjection
      .copy(this.projection)
      .multiply(this.view);
  }
}
