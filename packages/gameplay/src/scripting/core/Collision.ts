import type { Vec2 } from "@atlasjs/math";

/**
 * The contact a script receives when two colliders start touching.
 *
 * **Borrowed, not given.** Implementations own one instance and re-target it
 * before every dispatch, so this object — and the `Vec2` values it exposes —
 * are only valid for the duration of the callback that received it. A consumer
 * that needs to keep the point or the normal must copy them (`clone()`, or
 * `copyFrom` into a `Vec2` it owns). Storing the reference is silently wrong:
 * the values change at the next contact, not at the moment of the mistake.
 * Think of it as a pooled DOM event.
 *
 * **The normal points from `other` towards the script's own entity** — the
 * direction to push, recoil or spray an effect in. This is the opposite of the
 * engine-side `ContactPoint`, whose normal points from the first collider of
 * the pair to the second: a script never has to work out which side of the
 * pair it is on.
 */
export type Collision = {
  /** Contact position in world space, in game units. */
  readonly point: Vec2;
  /**
   * Contact normal in world space, pointing from the other entity towards the
   * script's own entity. A direction: it carries no unit and is never scaled.
   */
  readonly normal: Vec2;
  /** Magnitude of the impulse applied at this contact by the solver. */
  readonly impulse: number;
};
