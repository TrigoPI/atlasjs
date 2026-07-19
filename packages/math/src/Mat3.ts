import { Transform2DLike } from "./Transform2DLike";
import { Vec2 } from "./Vec2";

//prettier-ignore
export class Mat3 {
  public readonly buffer: Float32Array;

  public constructor() {
    this.buffer = new Float32Array([
      1, 0, 0,
      0, 1, 0,
      0, 0, 1,
    ]);
  }

  public identity(): Mat3 {
    const m: Float32Array = this.buffer;
    m[0] = 1; m[3] = 0; m[6] = 0;
    m[1] = 0; m[4] = 1; m[7] = 0;
    m[2] = 0; m[5] = 0; m[8] = 1;
    return this;
  }

  public copy(mat: Mat3): Mat3 {
    this.buffer.set(mat.buffer);
    return this;
  }

  public clone(): Mat3 {
    const m = new Mat3();
    m.buffer.set(this.buffer);
    return m;
  }

  public fromTransform2D(t: Transform2DLike): Mat3 {
    const m: Float32Array = this.buffer;

    const c: number = Math.cos(t.rotation);
    const s: number = Math.sin(t.rotation);
    const sx: number = t.scale.x;
    const sy: number = t.scale.y;

    // column 0
    m[0] = c * sx;
    m[1] = s * sx;
    m[2] = 0;

    // column 1
    m[3] = -s * sy;
    m[4] = c * sy;
    m[5] = 0;

    // column 2 (translation)
    m[6] = t.position.x;
    m[7] = t.position.y;
    m[8] = 1;

    return this;
  }

  public transformPoint2(x: number, y: number): Vec2 {
    const m: Float32Array = this.buffer;
    return new Vec2(
      m[0] * x + m[3] * y + m[6],
      m[1] * x + m[4] * y + m[7],
    );
  }

  public multiply(b: Mat3): Mat3 {
    const a: Float32Array = this.buffer;
    const o: Float32Array = b.buffer;

    const a0: number = a[0], a1: number = a[1], a2: number = a[2];
    const a3: number = a[3], a4: number = a[4], a5: number = a[5];
    const a6: number = a[6], a7: number = a[7], a8: number = a[8];

    const b0: number = o[0], b1: number = o[1], b2: number = o[2];
    const b3: number = o[3], b4: number = o[4], b5: number = o[5];
    const b6: number = o[6], b7: number = o[7], b8: number = o[8];

    a[0] = a0 * b0 + a3 * b1 + a6 * b2;
    a[1] = a1 * b0 + a4 * b1 + a7 * b2;
    a[2] = a2 * b0 + a5 * b1 + a8 * b2;

    a[3] = a0 * b3 + a3 * b4 + a6 * b5;
    a[4] = a1 * b3 + a4 * b4 + a7 * b5;
    a[5] = a2 * b3 + a5 * b4 + a8 * b5;

    a[6] = a0 * b6 + a3 * b7 + a6 * b8;
    a[7] = a1 * b6 + a4 * b7 + a7 * b8;
    a[8] = a2 * b6 + a5 * b7 + a8 * b8;

    return this;
  }

  public invert(): Mat3 {
    const m: Float32Array = this.buffer;

    const a: number = m[0], b: number = m[3], c: number = m[6];
    const d: number = m[1], e: number = m[4], f: number = m[7];
    const g: number = m[2], h: number = m[5], i: number = m[8];

    const A: number = e * i - f * h;
    const B: number = f * g - d * i;
    const C: number = d * h - e * g;

    const det: number = a * A + b * B + c * C;

    if (det === 0) {
      return this.identity();
    }

    const invDet: number = 1 / det;

    m[0] = A * invDet;
    m[1] = B * invDet;
    m[2] = C * invDet;
    m[3] = (c * h - b * i) * invDet;
    m[4] = (a * i - c * g) * invDet;
    m[5] = (b * g - a * h) * invDet;
    m[6] = (b * f - c * e) * invDet;
    m[7] = (c * d - a * f) * invDet;
    m[8] = (a * e - b * d) * invDet;

    return this;
  }

  public getTranslation(out: Vec2 = new Vec2()): Vec2 {
    const m: Float32Array = this.buffer;
    return out.set(m[6], m[7]);
  }

  public getRotation(): number {
    const m: Float32Array = this.buffer;
    return Math.atan2(m[1], m[0]);
  }

  public getScale(out: Vec2 = new Vec2()): Vec2 {
    const m: Float32Array = this.buffer;
    const sx: number = Math.hypot(m[0], m[1]);
    const sy: number = Math.hypot(m[3], m[4]);
    return out.set(sx, sy);
  }

  public static multiply(a: Mat3, b: Mat3): Mat3 {
    return a.clone().multiply(b);
  }

  public static identity(): Mat3 {
    return new Mat3();
  }

  public static fromTransform2D(t: Transform2DLike): Mat3 {
    return new Mat3().fromTransform2D(t);
  }
}
