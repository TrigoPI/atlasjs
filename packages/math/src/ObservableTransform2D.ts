import { Observable } from "@atlasjs/utils";

import { ObservalbeVec2 } from "./ObservableVec2";
import { Transform2DLike } from "./Transform2DLike";

import { Vec2Like } from "./Vec2Like";
import { Vec2 } from "./Vec2";

export class ObservableTransform2D implements Transform2DLike {
  private readonly _position: ObservalbeVec2;
  private readonly _scale: ObservalbeVec2;
  private readonly observer: Observable;

  private _rotation: number;

  public constructor(
    observer: Observable,
    position: Vec2Like = new Vec2(),
    scale: Vec2Like = new Vec2(1, 1),
    rotation: number = 0,
  ) {
    this.observer = observer;
    this._position = ObservalbeVec2.from(observer, position);
    this._scale = ObservalbeVec2.from(observer, scale);
    this._rotation = rotation;
  }

  public get position(): ObservalbeVec2 {
    return this._position;
  }

  public get scale(): ObservalbeVec2 {
    return this._scale;
  }

  public set rotation(value: number) {
    if (value === this._rotation) return;
    this._rotation = value;
    this.observer.notifyChange();
  }

  public get rotation(): number {
    return this._rotation;
  }

  public copyFrom(a: Transform2DLike): ObservableTransform2D {
    this.position.copyFrom(a.position);
    this.scale.copyFrom(a.scale);
    this.rotation = a.rotation;
    return this;
  }

  public setPosition(x: number, y: number): ObservableTransform2D {
    this.position.set(x, y);
    return this;
  }

  public setScale(x: number, y: number): ObservableTransform2D {
    this.scale.set(x, y);
    return this;
  }

  public setRotation(r: number): ObservableTransform2D {
    if (r === this.rotation) return this;
    this.rotation = r;
    this.observer.notifyChange();
    return this;
  }

  public translate(translation: Vec2Like): ObservableTransform2D {
    this.position.add(translation);
    return this;
  }

  public static identity(observer: Observable): ObservableTransform2D {
    return new ObservableTransform2D(observer);
  }

  public static from(
    observer: Observable,
    a: Transform2DLike,
  ): ObservableTransform2D {
    return new ObservableTransform2D(observer, a.position, a.scale, a.rotation);
  }

  public static create(observer: Observable): ObservableTransform2D {
    return new ObservableTransform2D(observer);
  }
}
