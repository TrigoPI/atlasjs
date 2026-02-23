import { Observable } from "@atlasjs/utils";
import { Vec2Like } from "./Vec2Like";

export class ObservableVec2 implements Vec2Like {
  private _x: number;
  private _y: number;

  private observer: Observable;

  public constructor(observer: Observable, x: number = 0, y: number = 0) {
    this.observer = observer;
    this._x = x;
    this._y = y;
    this.observer.notifyChange();
  }

  public static from(observer: Observable, a: Vec2Like): ObservableVec2 {
    return new ObservableVec2(observer, a.x, a.y);
  }

  public get x(): number {
    return this._x;
  }

  public set x(value: number) {
    if (value === this._x) return;
    this._x = value;
    this.observer.notifyChange();
  }

  public get y(): number {
    return this._y;
  }

  public set y(value: number) {
    if (value === this._y) return;
    this._y = value;
    this.observer.notifyChange();
  }

  public copyFrom(va: Vec2Like): Vec2Like {
    if (va.x === this._x && va.y === this._y) return this;
    this._x = va.x;
    this._y = va.y;
    this.observer.notifyChange();
    return this;
  }

  public set(x: number, y: number): ObservableVec2 {
    if (x === this._x && y === this._y) return this;
    this._x = x;
    this._y = y;
    this.observer.notifyChange();
    return this;
  }

  public add(b: Vec2Like): ObservableVec2 {
    if (b.x === 0 && b.y === 0) return this;
    this._x += b.x;
    this._y += b.y;
    this.observer.notifyChange();
    return this;
  }

  public sub(b: Vec2Like): ObservableVec2 {
    if (b.x === 0 && b.y === 0) return this;
    this._x -= b.x;
    this._y -= b.y;
    this.observer.notifyChange();
    return this;
  }

  public mult(k: number): ObservableVec2 {
    if (k === 1) return this;
    this._x *= k;
    this._y *= k;
    this.observer.notifyChange();
    return this;
  }

  public normalize(): ObservableVec2 {
    const mag = this.mag();
    if (mag === 0) return this;
    this._x /= mag;
    this._y /= mag;
    this.observer.notifyChange();
    return this;
  }

  public swap(): Vec2Like {
    const temp: number = this._x;
    this._x = this._y;
    this._y = temp;
    this.observer.notifyChange();
    return this;
  }

  public dot(b: Vec2Like): number {
    return this._x * b.x + this._y * b.y;
  }

  public mag(): number {
    return Math.sqrt(this._x ** 2 + this._y ** 2);
  }

  public copy(): Vec2Like {
    return new ObservableVec2(this.observer, this._x, this._y);
  }
}
