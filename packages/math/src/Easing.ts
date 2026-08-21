const BACK_OVERSHOOT: number = 1.70158;

export class Easing {
  public static inOutQuad(t: number): number {
    const inv: number = 1 - t;
    return t < 0.5 ? 2 * t * t : 1 - 2 * inv * inv;
  }

  public static outCubic(t: number): number {
    const inv: number = 1 - t;
    return 1 - inv * inv * inv;
  }

  public static outQuint(t: number): number {
    const inv: number = 1 - t;
    return 1 - inv * inv * inv * inv * inv;
  }

  public static outBack(t: number): number {
    const inv: number = t - 1;
    return (
      1 + (BACK_OVERSHOOT + 1) * inv * inv * inv + BACK_OVERSHOOT * inv * inv
    );
  }
}
