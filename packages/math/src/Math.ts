import { Mat2 } from "./Mat2";

export const PI: number = Math.PI;
export const PI_2: number = PI * 2;
export const PI_4: number = PI / 4;
export const RAD_TO_DEG: number = 180 / PI;

export const cos = Math.cos;
export const sin = Math.sin;
export const tan = Math.tan;
export const atan2 = Math.atan2;

export class MathUtils {
  public static clamp(value: number, min: number, max: number): number {
    return Math.max(min, Math.min(max, value));
  }
}

export class Angle {
  public static radToDeg(rad: number): number {
    return rad * RAD_TO_DEG;
  }
}

export class Matrix {
  public static translateTo(x: number, y: number, out: Mat2): Mat2 {
    out.setTranslate(x, y);
    return out;
  }

  public static multTo(a: Mat2, b: Mat2, out: Mat2): Mat2 {
    a.multTo(b, out);
    return out;
  }

  public static withoutScaleTo(a: Mat2, out: Mat2): Mat2 {
    let ax: number = a.a;
    let ay: number = a.b;
    let bx: number = a.c;
    let by: number = a.d;

    const lenX: number = Math.hypot(ax, ay);
    const lenY: number = Math.hypot(bx, by);

    if (lenX > 1e-6) {
      ax /= lenX;
      ay /= lenX;
    } else {
      ax = 1;
      ay = 0;
    }

    if (lenY > 1e-6) {
      by /= lenY;
      bx /= lenY;
    } else {
      bx = 0;
      by = 1;
    }

    out.set(ax, ay, bx, by, a.tx, a.ty);
    return out;
  }
}
