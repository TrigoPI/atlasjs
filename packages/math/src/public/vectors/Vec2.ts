import { Vec2Like } from "./Vec2Like";

export class Vec2 implements Vec2Like {
  public x: number;
  public y: number;

  public constructor(x: number = 0, y: number = 0) {
    this.x = x;
    this.y = y;
  }

  public static from(a: Vec2Like): Vec2 {
    return new Vec2(a.x, a.y);
  }

  public copyFrom(a: Vec2Like): Vec2 {
    this.x = a.x;
    this.y = a.y;
    return this;
  }

  public set(x: number = 0, y: number = 0): Vec2 {
    this.x = x;
    this.y = y;
    return this;
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
    const m: number = this.mag();
    if (m === 0) return this;
    return this.mult(1 / m);
  }

  public swap(): Vec2 {
    const temp: number = this.x;
    this.x = this.y;
    this.y = temp;
    return this;
  }

  public dot(a: Vec2): number {
    return this.x * a.x + this.y * a.y;
  }

  public mag(): number {
    return Math.sqrt(this.x * this.x + this.y * this.y);
  }

  public copy(): Vec2 {
    return new Vec2(this.x, this.y);
  }
}
