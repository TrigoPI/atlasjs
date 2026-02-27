import { Transform2DLike } from "./Transform2DLike";
import { Vec2 } from "./Vec2";
import { Vec2Like } from "./Vec2Like";

export class Transform2D implements Transform2DLike {
  public position: Vec2;
  public scale: Vec2;
  public rotation: number;

  public constructor(
    position: Vec2 = new Vec2(),
    scale: Vec2 = new Vec2(1, 1),
    rotation: number = 0,
  ) {
    this.position = position;
    this.rotation = rotation;
    this.scale = scale;
  }

  public copyFrom(a: Transform2DLike): Transform2D {
    this.position.copyFrom(a.position);
    this.scale.copyFrom(a.scale);
    this.rotation = a.rotation;
    return this;
  }

  public setPosition(x: number, y: number): Transform2D {
    this.position.set(x, y);
    return this;
  }

  public setScale(x: number, y: number): Transform2D {
    this.scale.set(x, y);
    return this;
  }

  public setRotation(r: number): Transform2D {
    this.rotation = r;
    return this;
  }

  public translate(translation: Vec2Like): Transform2D {
    this.position.add(translation);
    return this;
  }

  public static identity(): Transform2D {
    return new Transform2D(new Vec2(), new Vec2(1, 1), 0);
  }

  public static from(a: Transform2D): Transform2D {
    return new Transform2D(a.position, a.scale, a.rotation);
  }

  public static create(
    position: Vec2 = new Vec2(),
    scale: Vec2 = new Vec2(1, 1),
    rotation: number = 0,
  ): Transform2D {
    return new Transform2D(Vec2.from(position), Vec2.from(scale), rotation);
  }
}
