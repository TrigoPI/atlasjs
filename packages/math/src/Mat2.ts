import { Transform2DLike } from "./Transform2DLike";
import { Vec2Like } from "./Vec2Like";
import { Vec2 } from "./Vec2";

/**
 * 2D Matrix
 * | a c tx |
 * | b d ty |
 */
export class Mat2 {
  public a: number;
  public b: number;
  public c: number;
  public d: number;
  public tx: number;
  public ty: number;

  public constructor() {
    this.a = 1;
    this.b = 0;
    this.c = 0;
    this.d = 1;
    this.tx = 0;
    this.ty = 0;
  }

  public copy(): Mat2 {
    const m: Mat2 = new Mat2();
    return m.copyFrom(this);
  }

  public copyFrom(m: Mat2): Mat2 {
    this.a = m.a;
    this.b = m.b;
    this.c = m.c;
    this.d = m.d;
    this.tx = m.tx;
    this.ty = m.ty;
    return this;
  }

  public fromTransform2D(t: Transform2DLike): Mat2 {
    const sx: number = t.scale.x;
    const sy: number = t.scale.y;
    const r: number = t.rotation;

    const cos: number = r === 0 ? 1 : Math.cos(r);
    const sin: number = r === 0 ? 0 : Math.sin(r);

    this.a = cos * sx;
    this.b = sin * sx;
    this.c = -sin * sy;
    this.d = cos * sy;

    this.tx = t.position.x;
    this.ty = t.position.y;

    return this;
  }

  public setTranslate(x: number, y: number): Mat2 {
    this.a = 1;
    this.b = 0;
    this.c = 0;
    this.d = 1;
    this.tx = x;
    this.ty = y;
    return this;
  }

  public setScale(sx: number, sy: number): this {
    this.a = sx;
    this.b = 0;
    this.c = 0;
    this.d = sy;
    this.tx = 0;
    this.ty = 0;
    return this;
  }

  public setRotate(r: number): this {
    const c: number = Math.cos(r);
    const s: number = Math.sin(r);
    this.a = c;
    this.b = s;
    this.c = -s;
    this.d = c;
    this.tx = 0;
    this.ty = 0;
    return this;
  }

  public mult(other: Mat2): Mat2 {
    const a: number = this.a * other.a + this.c * other.b;
    const b: number = this.b * other.a + this.d * other.b;
    const c: number = this.a * other.c + this.c * other.d;
    const d: number = this.b * other.c + this.d * other.d;
    const tx: number = this.a * other.tx + this.c * other.ty + this.tx;
    const ty: number = this.b * other.tx + this.d * other.ty + this.ty;

    this.a = a;
    this.b = b;
    this.c = c;
    this.d = d;
    this.tx = tx;
    this.ty = ty;

    return this;
  }

  public invert(): Mat2 {
    const det: number = this.a * this.d - this.b * this.c;

    if (det === 0) {
      return this;
    }

    const a: number = this.d / det;
    const b: number = -this.b / det;
    const c: number = -this.c / det;
    const d: number = this.a / det;
    const tx: number = (this.c * this.ty - this.d * this.tx) / det;
    const ty: number = (this.b * this.tx - this.a * this.ty) / det;

    this.a = a;
    this.b = b;
    this.c = c;
    this.d = d;
    this.tx = tx;
    this.ty = ty;

    return this;
  }

  public getTranslate(): Vec2 {
    return new Vec2(this.tx, this.ty);
  }

  public getScale(): Vec2 {
    return new Vec2(this.a, this.d);
  }

  public getXAxis(): Vec2 {
    return new Vec2(this.a, this.b);
  }

  public getYAxis(): Vec2 {
    return new Vec2(this.c, this.d);
  }

  public multVec2(vec2: Vec2Like): Vec2 {
    return new Vec2(
      this.a * vec2.x + this.c * vec2.y + this.tx,
      this.b * vec2.x + this.d * vec2.y + this.ty,
    );
  }

  public set(
    a: number,
    b: number,
    c: number,
    d: number,
    tx: number,
    ty: number,
  ): this {
    this.a = a;
    this.b = b;
    this.c = c;
    this.d = d;
    this.tx = tx;
    this.ty = ty;
    return this;
  }

  public multVec2To(vec2: Vec2Like, target: Vec2Like): void {
    target.set(
      this.a * vec2.x + this.c * vec2.y + this.tx,
      this.b * vec2.x + this.d * vec2.y + this.ty,
    );
  }

  public multTo(other: Mat2, target: Mat2): void {
    target.set(
      this.a * other.a + this.c * other.b,
      this.b * other.a + this.d * other.b,
      this.a * other.c + this.c * other.d,
      this.b * other.c + this.d * other.d,
      this.a * other.tx + this.c * other.ty + this.tx,
      this.b * other.tx + this.d * other.ty + this.ty,
    );
  }

  public getTranslateTo(out: Vec2Like): void {
    out.set(this.tx, this.ty);
  }

  public getScaleTo(out: Vec2Like): void {
    out.set(this.a, this.d);
  }

  public getXAxisTo(out: Vec2Like): void {
    out.set(this.a, this.b);
  }

  public getYAxisTo(out: Vec2Like): void {
    out.set(this.c, this.d);
  }

  public static identity(): Mat2 {
    return new Mat2();
  }
}
