import { Vec2Like } from "./Vec2Like";

export class Vec2 extends Vec2Like {
  public get x(): number {
    return this._x;
  }

  public set x(x: number) {
    this._x = x;
  }

  public get y(): number {
    return this._y;
  }

  public set y(y: number) {
    this._y = y;
  }

  public set mag(k: number) {
    this.normalize().mult(k);
  }

  public get mag(): number {
    return Math.sqrt(this.x ** 2 + this.y ** 2);
  }

  public set(x: number = 0, y: number = 0): void {
    this.x = x;
    this.y = y;
  }

  public add(b: Vec2Like): Vec2 {
    this.x += b.x;
    this.y += b.y;
    return this;
  }

  public sub(b: Vec2Like): Vec2 {
    this.x -= b.x;
    this.y -= b.y;
    return this;
  }

  public mult(k: number): Vec2 {
    this.x *= k;
    this.y *= k;
    return this;
  }

  public normalize(): Vec2 {
    const m: number = this.mag;
    if (m === 0) return this;
    return this.mult(1 / m);
  }

  public dot(a: Vec2Like): number {
    return this.x * a.x + this.y * a.y;
  }

  public swap(): Vec2 {
    const temp: number = this.x;
    this.x = this.y;
    this.y = temp;
    return this;
  }

  public copy(): Vec2 {
    return new Vec2(this.x, this.y);
  }

  public static create(x: number = 0, y: number = 0): Vec2 {
    return new Vec2(x, y);
  }
}
