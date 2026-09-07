import { Vec2 } from "@atlasjs/math";

/* Module-owned scratch. impactSpeedBetween neither yields nor calls out, so nothing can observe
   these mid-computation, and the collision path is the one place the repo has already measured
   as allocation-sensitive (GAMEPLAY-89). */
const relativeVelocity: Vec2 = new Vec2();
const contactNormal: Vec2 = new Vec2();

/* One formula, two callers: PlayerSoundScript offline and the server's bump reporter. A server
   that computed a different number would pitch the same collision differently depending on the
   mode, which is the kind of drift nobody ever traces back. */
export function impactSpeedBetween(
  selfPosition: Vec2,
  selfVelocity: Vec2,
  otherPosition: Vec2,
  otherVelocity: Vec2,
): number {
  Vec2.subTo(selfVelocity, otherVelocity, relativeVelocity);
  Vec2.subTo(otherPosition, selfPosition, contactNormal);
  contactNormal.normalize();

  return Math.abs(relativeVelocity.dot(contactNormal));
}

/* onCollisionEnter fires twice per pair — once per direction — on every sub-step. Without this
   rule a single bump is one sound per participant offline and two events on the wire online.
   The lower entity id is the one that speaks. */
export function reportsPair(selfId: number, otherId: number): boolean {
  return selfId <= otherId;
}
