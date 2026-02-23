import { Observable } from "@atlasjs/utils";

import { ObservableVec2, Vec2, Vec2Like } from "../vectors";
import { Transform2DLike } from "./Transform2DLike";

export class ObservableTransform2D implements Transform2DLike {
  private _position: Vec2;
  private _scale: Vec2;
  private _rotation: number;

  private readonly _observer: Observable;

  public constructor(
    observer: Observable,
    position: Vec2Like = new Vec2(),
    scale: Vec2Like = new Vec2(1, 1),
    rotation: number = 0,
  ) {
    this._observer = observer;
    this._rotation = rotation;
    this._position = new ObservableVec2(observer, position.x, position.y);
    this._scale = new ObservableVec2(observer, scale.x, scale.y);
  }

  public static from(
    observer: Observable,
    transform: Transform2DLike,
  ): ObservableTransform2D {
    return new ObservableTransform2D(
      observer,
      transform.position,
      transform.scale,
      transform.rotation,
    );
  }

  public get position(): Vec2 {
    return this._position;
  }

  public get scale(): Vec2 {
    return this._scale;
  }

  public get rotation(): number {
    return this._rotation;
  }

  public set rotation(r: number) {
    if (this._rotation === r) return;
    this._rotation = r;
    this._observer.notifyChange();
  }

  public setPosition(x: number, y: number): ObservableTransform2D {
    this._position.set(x, y);
    return this;
  }

  public setScale(x: number, y: number): ObservableTransform2D {
    this._scale.set(x, y);
    return this;
  }

  public setRotation(r: number): ObservableTransform2D {
    if (this._rotation === r) return this;
    this._rotation = r;
    this._observer.notifyChange();
    return this;
  }

  public translate(translation: Vec2): ObservableTransform2D {
    this._position.add(translation);
    return this;
  }

  public rotate(dr: number): ObservableTransform2D {
    if (dr === 0) return this;
    this._rotation += dr;
    return this;
  }
}
