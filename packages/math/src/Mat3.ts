import { Transform2D } from "./Transform2D";
import { Vec2 } from "./Vec2";

/**
 * Column-major 3x3 matrix, primarily used for 2D affine transforms.
 *
 * The backing `buffer` stores the three columns contiguously:
 * `[c0x, c0y, c0z, c1x, c1y, c1z, c2x, c2y, c2z]`.
 *
 * Note: this is the tight 9-float representation. WGSL's `mat3x3<f32>` pads
 * each column to 16 bytes; that padding is applied at upload time by the
 * renderer's uniform packer, not here.
 */
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

  public fromTransform2D(t: Transform2D): Mat3 {
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

  public static identity(): Mat3 {
    return new Mat3();
  }

  public static fromTransform2D(t: Transform2D): Mat3 {
    return new Mat3().fromTransform2D(t);
  }
}
