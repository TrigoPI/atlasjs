import { Vec2 } from "../vectors";
import { Transform2DLike } from "./Transform2DLike";

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

  public static from(a: Transform2DLike): Transform2D {
    return new Transform2D(a.position, a.scale, a.rotation);
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

  public translate(translation: Vec2): Transform2D {
    this.position.add(translation);
    return this;
  }

  public rotate(dr: number): Transform2D {
    if (dr === 0) return this;
    this.rotation += dr;
    return this;
  }
}
