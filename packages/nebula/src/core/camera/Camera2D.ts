import { Mat4, Vec2 } from "@atlasjs/math";

import { Camera } from "./Camera";

//prettier-ignore
export class Camera2D implements Camera {
  public readonly view: Mat4;
  public readonly projection: Mat4;
  public readonly viewProjection: Mat4;

  public readonly position: Vec2;
  public zoom: number;
  public pixelSnap: boolean;

  public constructor() {
    this.view = Mat4.identity();
    this.projection = Mat4.identity();
    this.viewProjection = Mat4.identity();
    this.position = Vec2.create();
    this.zoom = 1;
    this.pixelSnap = true;
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

  public update(width: number, height: number, pixelRatio: number = 1): void {
    this.projection
      .identity()
      .orthographic(0, width, height, 0, -1, 1);

    const scale: number = this.zoom * pixelRatio;

    let translateX: number = -this.position.x;
    let translateY: number = -this.position.y;

    if (this.pixelSnap && scale > 0) {
      translateX = Math.round(translateX * scale) / scale;
      translateY = Math.round(translateY * scale) / scale;
    }

    this.view
      .identity()
      .scale(this.zoom, this.zoom, 1)
      .translate(translateX, translateY, 0);

    this.viewProjection
      .copy(this.projection)
      .multiply(this.view);
  }

  public screenToWorld(screen: Vec2, out: Vec2 = new Vec2()): Vec2 {
    return out.set(
      this.position.x + screen.x / this.zoom,
      this.position.y + screen.y / this.zoom,
    );
  }

  public worldToScreen(world: Vec2, out: Vec2 = new Vec2()): Vec2 {
    return out.set(
      (world.x - this.position.x) * this.zoom,
      (world.y - this.position.y) * this.zoom,
    );
  }
}
