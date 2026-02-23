export interface Vec2Like {
  readonly x: number;
  readonly y: number;

  normalize(): Vec2Like;
  copyFrom(va: Vec2Like): Vec2Like;
  set(x: number, y: number): Vec2Like;
  add(b: Vec2Like): Vec2Like;
  sub(b: Vec2Like): Vec2Like;
  mult(k: number): Vec2Like;
  dot(b: Vec2Like): number;
  mag(): number;
  swap(): Vec2Like;
  copy(): Vec2Like;
}
