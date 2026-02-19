import { Vec2, Vec2Like } from "../vec2";
import { Transform2DLike } from "./Transform2DLike";

export class Transform2D extends Transform2DLike {
  public constructor(
    position: Vec2Like = Vec2.create(),
    scale: Vec2Like = Vec2.create(1, 1),
    rotation: number = 0,
  ) {
    super(position, scale, rotation);
  }

  public get position(): Vec2Like {
    return this._position;
  }

  public get scale(): Vec2Like {
    return this._scale;
  }

  public set rotation(value: number) {
    if (value === this._rotation) return;
    this._rotation = value;
  }

  public get rotation(): number {
    return this._rotation;
  }

  public setPosition(x: number, y: number): Transform2DLike {
    this.position.set(x, y);
    return this;
  }

  public setScale(x: number, y: number): Transform2DLike {
    this.scale.set(x, y);
    return this;
  }

  public setRotation(r: number): Transform2DLike {
    this._rotation = r;
    return this;
  }

  public translate(translation: Vec2Like): Transform2DLike {
    this.position.add(translation);
    return this;
  }

  public rotate(dr: number): Transform2DLike {
    if (dr === 0) return this;
    this._rotation += dr;
    return this;
  }

  public static create(
    position: Vec2Like = Vec2.create(),
    scale: Vec2Like = Vec2.create(1, 1),
    rotation: number = 0,
  ): Transform2D {
    return new Transform2D(position, scale, rotation);
  }
}
