import { Vec2Like, Box2, Mat2, Vec2 } from "@atlasjs/math";

export abstract class Camera2D {
  protected abstract _position: Vec2Like;
  protected abstract _viewport: Box2;
  protected abstract _zoom: number;
  protected abstract _rotation: number;

  protected readonly view: Mat2;
  protected readonly invView: Mat2;

  public constructor() {
    this.view = new Mat2();
    this.invView = new Mat2();
  }

  abstract get zoom(): number;
  abstract set zoom(v: number);

  abstract get rotation(): number;
  abstract set rotation(v: number);

  abstract get position(): Vec2Like;
  abstract set position(v: Vec2Like);

  abstract viewMatrix(): Mat2;
  abstract invViewMatrix(): Mat2;
  abstract setViewportSize(width: number, height: number): void;
  abstract screenToWorld(screen: Vec2Like): Vec2;
  abstract worldToScreen(world: Vec2Like): Vec2;
}
