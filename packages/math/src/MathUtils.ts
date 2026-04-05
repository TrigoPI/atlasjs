import { RAD_TO_DEG } from "./Math";

export class MathUtils {
  public static clamp(value: number, min: number, max: number): number {
    return Math.max(min, Math.min(max, value));
  }

  public static radToDeg(rad: number): number {
    return rad * RAD_TO_DEG;
  }
}
