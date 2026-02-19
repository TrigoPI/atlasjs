export abstract class Vec2Like {
  protected _x: number;
  protected _y: number;

  public constructor(x: number = 0, y: number = 0) {
    this._x = x;
    this._y = y;
  }

  abstract set mag(k: number);
  abstract get mag(): number;

  abstract set x(x: number);
  abstract get x(): number;

  abstract set y(y: number);
  abstract get y(): number;

  abstract swap(): Vec2Like;
  abstract copy(): Vec2Like;
  abstract normalize(): Vec2Like;
  abstract add(b: Vec2Like): Vec2Like;
  abstract sub(b: Vec2Like): Vec2Like;
  abstract mult(k: number): Vec2Like;
  abstract dot(a: Vec2Like): number;
  abstract set(x: number, y: number): void;
}
