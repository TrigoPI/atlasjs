import { Tag, Transform2D, type EntityBuilder } from "@atlasjs/gameplay";

import { ARENA_SCALE } from "../arena/bounds";

/* No collider, on purpose: the arena edge is the isInsideArena predicate in
   sim/arena/bounds.ts, not a physics object. The entity is built anyway so the headless
   server owns an arena entity with the same transform and tag as the client's. */
export function buildArenaSim(entity: EntityBuilder): void {
  const transform: Transform2D = entity.add(Transform2D);
  transform.position.set(0, 0);
  transform.scale.set(ARENA_SCALE, ARENA_SCALE);

  entity.add(Tag, "Arena");
}
