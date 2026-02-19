import { Observable } from "../../internal";
import { Vec2ChangeCallback } from "./types";
import { Vec2Like } from "./Vec2Like";

export class ObservableVec2 extends Vec2Like {
  private observer: Observable<Vec2ChangeCallback>;

  public constructor(x: number = 0, y: number = 0) {
    super(x, y);
    this.observer = new Observable<Vec2ChangeCallback>();
  }

  public set x(x: number) {
    if (this._x === x) return;
    this._x = x;
    this.observer.notifyChange();
  }

  public get x(): number {
    return this._x;
  }

  public get y(): number {
    return this._y;
  }

  public set y(y: number) {
    if (this._y === y) return;
    this._y = y;
    this.observer.notifyChange();
  }

  public set mag(k: number) {
    this.normalize().mult(k);
  }

  public get mag(): number {
    return Math.sqrt(this.x ** 2 + this.y ** 2);
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
    const m: number = this.mag;
    if (m === 0) return this;
    return this.mult(1 / m);
  }

  public dot(a: Vec2Like): number {
    return this._x * a.x + this._y * a.y;
  }

  public swap(): ObservableVec2 {
    const temp: number = this._x;
    this._x = this._y;
    this._y = temp;
    this.observer.notifyChange();
    return this;
  }

  public copy(): ObservableVec2 {
    return new ObservableVec2(this._x, this._y);
  }

  public set(x: number = 0, y: number = 0): void {
    this._x = x;
    this._y = y;

    if (this._x === x && this._y === y) return;
    this.observer.notifyChange();
  }

  public bind(cb: Vec2ChangeCallback): void {
    if (this.observer.isBound()) {
      throw new Error("Vec2 is already bound to a callback");
    }

    this.observer.bind(cb);
  }

  public static create(x: number = 0, y: number = 0): ObservableVec2 {
    return new ObservableVec2(x, y);
  }
}
