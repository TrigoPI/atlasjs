/**
 * Describes a camera kick: how hard it starts, how tightly it is pulled
 * back and how fast the ringing dies. Presets cover the usual cases;
 * spread one to depart from it, e.g. `{ ...ShakePresets.heavy, strength: 200 }`.
 */
export type ShakeSpec = {
  /** Initial kick speed, in world units per second. */
  strength: number;
  /** Pull back towards centre. Higher snaps back faster. */
  stiffness: number;
  /** How quickly the ringing dies. Higher settles in fewer swings. */
  damping: number;
};

export const ShakePresets = {
  /** Barely there: a footstep, a pickup. */
  light: { strength: 40, stiffness: 420, damping: 28 },
  /** A clean hit. */
  medium: { strength: 90, stiffness: 320, damping: 22 },
  /** A heavy blow, a wall slam. */
  heavy: { strength: 170, stiffness: 240, damping: 17 },
  /** Slow and loose: an explosion, a collapse. */
  rumble: { strength: 70, stiffness: 90, damping: 6 },
} as const satisfies Record<string, ShakeSpec>;
