import { Vec2 } from "@atlasjs/math";

export class Vector2D {
  private readonly vec2: Vec2;

  constructor(x: number = 0, y: number = 0) {
    this.vec2 = new Vec2(x, y);
  }

  public get x(): number {
    return this.vec2.x;
  }

  public set x(value: number) {
    this.vec2.x = value;
  }

  public get y(): number {
    return this.vec2.y;
  }

  public set y(value: number) {
    this.vec2.y = value;
  }

  public clone(): Vector2D {
    return new Vector2D(this.vec2.x, this.vec2.y);
  }

  public copy(other: Vector2D): Vector2D {
    this.vec2.copyFrom(other.vec2);
    return this;
  }

  public set(x: number, y: number): Vector2D {
    this.vec2.set(x, y);
    return this;
  }

  public add(other: Vector2D): Vector2D {
    this.vec2.add(other.vec2);
    return this;
  }

  public sub(other: Vector2D): Vector2D {
    this.vec2.sub(other.vec2);
    return this;
  }

  public mult(scalar: number): Vector2D {
    this.vec2.mult(scalar);
    return this;
  }

  public normalize(): Vector2D {
    this.vec2.normalize();
    return this;
  }

  public clamp(min: number): Vector2D {
    this.vec2.clamp(min);
    return this;
  }

  public swap(): Vector2D {
    this.vec2.swap();
    return this;
  }

  public mag(): number {
    return this.vec2.mag();
  }

  public dot(): number {
    return Vector2D.dot(this, this);
  }

  public static from(other: Vector2D): Vector2D {
    return new Vector2D(other.x, other.y);
  }

  public static add(a: Vector2D, b: Vector2D): Vector2D {
    return new Vector2D(a.x + b.x, a.y + b.y);
  }

  public static sub(a: Vector2D, b: Vector2D): Vector2D {
    return new Vector2D(a.x - b.x, a.y - b.y);
  }

  public static mult(a: Vector2D, scalar: number): Vector2D {
    return new Vector2D(a.x * scalar, a.y * scalar);
  }

  public static dot(a: Vector2D, b: Vector2D): number {
    return a.x * b.x + a.y * b.y;
  }

  public static create(x: number, y: number): Vector2D {
    return new Vector2D(x, y);
  }
}
