import { Transform2DLike } from "./Transform2DLike";
import { Vec2 } from "./Vec2";

//prettier-ignore
export class Mat4 {
  public readonly buffer: Float32Array;

  public constructor() {
    this.buffer = new Float32Array([
      1, 0, 0, 0,
      0, 1, 0, 0,
      0, 0, 1, 0,
      0, 0, 0, 1
    ]);
  }

  public identity(): Mat4 {
    const m: Float32Array = this.buffer;
    m[0] = 1; m[4] = 0; m[8]  = 0; m[12] = 0;
    m[1] = 0; m[5] = 1; m[9]  = 0; m[13] = 0;
    m[2] = 0; m[6] = 0; m[10] = 1; m[14] = 0;
    m[3] = 0; m[7] = 0; m[11] = 0; m[15] = 1;
    return this;
  }

  public orthographic(left: number, right: number, bottom: number, top: number, near: number, far: number): Mat4 {
    const m: Float32Array = this.buffer;
    const lr: number = 1 / (right - left);
    const bt: number = 1 / (top - bottom);
    const nf: number = 1 / (far - near);

    m[0] = 2 * lr;
    m[1] = 0;
    m[2] = 0;
    m[3] = 0;

    m[4] = 0;
    m[5] = 2 * bt;
    m[6] = 0;
    m[7] = 0;

    m[8] = 0;
    m[9] = 0;
    m[10] = -2 * nf;
    m[11] = 0;

    m[12] = -(right + left) * lr;
    m[13] = -(top + bottom) * bt;
    m[14] = -(far + near) * nf;
    m[15] = 1;

    return this;
  }

  public copy(mat: Mat4): Mat4 {
    this.buffer.set(mat.buffer);
    return this;
  }

  public clone(): Mat4 {
    const m = new Mat4();
    m.buffer.set(this.buffer);
    return m;
  }

  public translate(x: number, y: number, z = 0): Mat4 {
    const m: Float32Array = this.buffer;

    m[12] = m[0] * x + m[4] * y + m[8] * z + m[12];
    m[13] = m[1] * x + m[5] * y + m[9] * z + m[13];
    m[14] = m[2] * x + m[6] * y + m[10] * z + m[14];
    m[15] = m[3] * x + m[7] * y + m[11] * z + m[15];

    return this;
  }

  public scale(x: number, y: number, z = 1): Mat4 {
    const m: Float32Array = this.buffer;

    m[0] *= x;
    m[1] *= x;
    m[2] *= x;
    m[3] *= x;

    m[4] *= y;
    m[5] *= y;
    m[6] *= y;
    m[7] *= y;

    m[8] *= z;
    m[9] *= z;
    m[10] *= z;
    m[11] *= z;

    return this;
  }

  public rotateZ(rad: number): Mat4 {
    const m: Float32Array = this.buffer;

    const s: number = Math.sin(rad);
    const c: number = Math.cos(rad);

    const a00: number = m[0];
    const a01: number = m[1];
    const a02: number = m[2];
    const a03: number = m[3];
    const a10: number = m[4];
    const a11: number = m[5];
    const a12: number = m[6];
    const a13: number = m[7];

    m[0] = a00 * c + a10 * s;
    m[1] = a01 * c + a11 * s;
    m[2] = a02 * c + a12 * s;
    m[3] = a03 * c + a13 * s;

    m[4] = a10 * c - a00 * s;
    m[5] = a11 * c - a01 * s;
    m[6] = a12 * c - a02 * s;
    m[7] = a13 * c - a03 * s;

    return this;
  }

  public multiply(b: Mat4): Mat4 {
    const a: Float32Array = this.buffer;
    const m: Float32Array = b.buffer;
    const out: Float32Array = new Float32Array(16);

    for (let i = 0; i < 4; i++) {
      const ai0 = a[i];
      const ai1 = a[i + 4];
      const ai2 = a[i + 8];
      const ai3 = a[i + 12];

      out[i]      = ai0 * m[0]  + ai1 * m[1]  + ai2 * m[2]  + ai3 * m[3];
      out[i + 4]  = ai0 * m[4]  + ai1 * m[5]  + ai2 * m[6]  + ai3 * m[7];
      out[i + 8]  = ai0 * m[8]  + ai1 * m[9]  + ai2 * m[10] + ai3 * m[11];
      out[i + 12] = ai0 * m[12] + ai1 * m[13] + ai2 * m[14] + ai3 * m[15];
    }

    this.buffer.set(out);
    
    return this;
  }

  public fromTransform2D(t: Transform2DLike): Mat4 {
    return this.identity()
      .translate(t.position.x, t.position.y, 0)
      .rotateZ(t.rotation)
      .scale(t.scale.x, t.scale.y, 1);
  }

  public transformPoint2(x: number, y: number): Vec2 {
    const m: Float32Array = this.buffer;

    return new Vec2(
      m[0] * x + m[4] * y + m[12],
      m[1] * x + m[5] * y + m[13],
    );
  }

  public getTranslationX(): number {
    return this.buffer[12];
  }

  public getTranslationY(): number {
    return this.buffer[13];
  }

  public static identity(): Mat4 {
    return new Mat4();
  }

  public static orthographic(left: number, right: number, bottom: number, top: number, near: number, far: number ): Mat4 {
    return new Mat4().orthographic(left, right, bottom, top, near, far);
  }

  public static translation(x: number, y: number, z = 0): Mat4 {
    return new Mat4().translate(x, y, z);
  }

  public static scale(x: number, y: number, z = 1): Mat4 {
    return new Mat4().scale(x, y, z);
  }

  public static rotationZ(rad: number): Mat4 {
    return new Mat4().rotateZ(rad);
  }

  public static multiply(a: Mat4, b: Mat4): Mat4 {
    return a.clone().multiply(b);
  }

  public static fromTransform2D(t: Transform2DLike): Mat4 {
    return Mat4.identity()
      .translate(t.position.x, t.position.y, 0)
      .rotateZ(t.rotation)
      .scale(t.scale.x, t.scale.y, 1);
  }
}
