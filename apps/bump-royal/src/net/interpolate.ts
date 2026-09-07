import { TICK_HZ } from "./protocol";

export const SECONDS_PER_TICK: number = 1 / TICK_HZ;

/* Nine ticks, 150 ms. Past that the last known velocity is stale enough that carrying it on
   flings a ghost off the arena, which reads far worse than a frozen one: 150 ms at dashSpeed
   is already 105 units on a 660-wide slab. */
export const EXTRAPOLATE_MAX_TICKS: number = 9;

const TURN: number = Math.PI * 2;
const HALF_TURN: number = Math.PI;

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

export function normalizeAngle(angle: number): number {
  const wrapped: number = angle % TURN;

  if (wrapped > HALF_TURN) return wrapped - TURN;
  if (wrapped <= -HALF_TURN) return wrapped + TURN;

  return wrapped;
}

/* Lerping the raw radians would take the long way round whenever the pair straddles the ±PI
   seam, and the eyes would spin a full turn every time a player crosses it. */
export function lerpAngle(a: number, b: number, t: number): number {
  return normalizeAngle(a + normalizeAngle(b - a) * t);
}

export function alphaBetween(
  fromTick: number,
  toTick: number,
  tick: number,
): number {
  const span: number = toTick - fromTick;

  if (span <= 0) return 0;

  const alpha: number = (tick - fromTick) / span;

  if (alpha < 0) return 0;
  if (alpha > 1) return 1;

  return alpha;
}

/* Zero below the sample rather than a negative delta: a render clock that has not reached the
   oldest snapshot yet must hold on it, not walk backwards along its velocity. */
export function extrapolationTicks(fromTick: number, tick: number): number {
  const delta: number = tick - fromTick;

  if (delta < 0) return 0;

  return delta > EXTRAPOLATE_MAX_TICKS ? EXTRAPOLATE_MAX_TICKS : delta;
}
