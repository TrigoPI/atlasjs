import { Vec2Like } from "../vec2";

export abstract class Transform2DLike<T extends Vec2Like = Vec2Like> {
  protected _scale: T;
  protected _position: T;
  protected _rotation: number;

  public constructor(position: T, scale: T, rotation: number) {
    this._position = position;
    this._scale = scale;
    this._rotation = rotation;
  }

  public abstract get position(): Vec2Like;
  public abstract get scale(): Vec2Like;
  public abstract get rotation(): number;

  public abstract setPosition(x: number, y: number): Transform2DLike;
  public abstract setScale(x: number, y: number): Transform2DLike;
  public abstract setRotation(r: number): Transform2DLike;

  public abstract translate(translation: Vec2Like): Transform2DLike;
  public abstract rotate(dr: number): Transform2DLike;
}
