import { Transform2DLike } from "./transforms";
import { Vec2, Vec2Like } from "./vectors";

export class Mat2 {
  public a = 1;
  public b = 0;
  public c = 0;
  public d = 1;
  public tx = 0;
  public ty = 0;

  public static identity(): Mat2 {
    return new Mat2();
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

  public fromTransform2D(transform: Transform2DLike): Mat2 {
    this.a = transform.scale.x;
    this.b = 0;
    this.c = 0;
    this.d = transform.scale.y;
    this.tx = transform.position.x;
    this.ty = transform.position.y;
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

  public multVec2(vec2: Vec2Like): Vec2 {
    return new Vec2(
      this.a * vec2.x + this.c * vec2.y + this.tx,
      this.b * vec2.x + this.d * vec2.y + this.ty,
    );
  }
}
