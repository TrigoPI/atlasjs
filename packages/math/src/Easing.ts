export class Easing {
  public static inOutQuad(t: number): number {
    const inv: number = 1 - t;
    return t < 0.5 ? 2 * t * t : 1 - 2 * inv * inv;
  }

  public static outCubic(t: number): number {
    const inv: number = 1 - t;
    return 1 - inv * inv * inv;
  }
}
