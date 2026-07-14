export interface Vec2Like {
  x: number;
  y: number;

  clone(): Vec2Like;
  copyTo(out: Vec2Like): Vec2Like;
  copyFrom(a: Vec2Like): Vec2Like;
  set(x: number, y: number): Vec2Like;
  add(b: Vec2Like): Vec2Like;
  sub(b: Vec2Like): Vec2Like;
  mult(k: number): Vec2Like;
  clamp(max: number): Vec2Like;
  dot(a: Vec2Like): number;
  normalize(): Vec2Like;
  swap(): Vec2Like;
  mag(): number;
}
