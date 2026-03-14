import { Observable } from "@atlasjs/utils";
import { Vec2Like } from "./Vec2Like";

export class ObservalbeVec2 implements Vec2Like {
  private readonly observer: Observable;

  private _x: number;
  private _y: number;

  public constructor(observer: Observable, x: number = 0, y: number = 0) {
    this.observer = observer;
    this._x = x;
    this._y = y;
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

  public copyFrom(a: Vec2Like): ObservalbeVec2 {
    if (a.x === this._x && a.y === this._y) return this;
    this.x = a.x;
    this.y = a.y;
    this.observer.notifyChange();
    return this;
  }

  public copyTo(out: ObservalbeVec2): ObservalbeVec2 {
    out.set(this.x, this.y);
    return out;
  }

  public copy(): ObservalbeVec2 {
    return new ObservalbeVec2(this.observer, this.x, this.y);
  }

  public set(x: number = 0, y: number = 0): ObservalbeVec2 {
    if (x === this._x && y === this._y) return this;
    this.x = x;
    this.y = y;
    this.observer.notifyChange();
    return this;
  }

  public add(b: Vec2Like): ObservalbeVec2 {
    if (b.x === 0 && b.y === 0) return this;
    this.x += b.x;
    this.y += b.y;
    this.observer.notifyChange();
    return this;
  }

  public sub(b: Vec2Like): ObservalbeVec2 {
    if (b.x === 0 && b.y === 0) return this;
    this.x -= b.x;
    this.y -= b.y;
    this.observer.notifyChange();
    return this;
  }

  public mult(k: number): ObservalbeVec2 {
    if (k === 1) return this;
    this.x *= k;
    this.y *= k;
    this.observer.notifyChange();
    return this;
  }

  public normalize(): ObservalbeVec2 {
    const m: number = this.mag();
    if (m === 0) return this;
    this.x /= m;
    this.y /= m;
    this.observer.notifyChange();
    return this;
  }

  public swap(): ObservalbeVec2 {
    const temp: number = this.x;
    this.x = this.y;
    this.y = temp;
    this.observer.notifyChange();
    return this;
  }

  public clamp(max: number): ObservalbeVec2 {
    const mag: number = this.mag();

    if (this.mag() > max) {
      this._x /= mag;
      this._y /= mag;
      this._x *= mag;
      this._y *= mag;
      this.observer.notifyChange();
    }

    return this;
  }

  public dot(a: Vec2Like): number {
    return this.x * a.x + this.y * a.y;
  }

  public mag(): number {
    return Math.sqrt(this.x * this.x + this.y * this.y);
  }

  public static from(observer: Observable, a: Vec2Like): ObservalbeVec2 {
    return new ObservalbeVec2(observer, a.x, a.y);
  }

  public static create(
    observer: Observable,
    x: number = 0,
    y: number = 0,
  ): ObservalbeVec2 {
    return new ObservalbeVec2(observer, x, y);
  }
}
