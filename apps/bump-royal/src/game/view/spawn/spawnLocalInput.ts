import type { SceneContext } from "@atlasjs/core";
import { PlayerInput, type ActionMapDescriptor } from "@atlasjs/gameplay";
import { NEXUS, type Entity, type NexusWorld } from "@atlasjs/nexus";

import { MoveIntent } from "../../sim/MoveIntent";
import type { PlayerControlsType } from "../../sim/controls";

/* Online, the local player has no body and no view of its own — the server sends it back like
   everybody else. What stays local is the input, so it gets an entity of its own carrying the
   pair LocalIntentSampler and commitIntents already know how to fill. */
export function spawnLocalInput(
  ctx: SceneContext,
  controls: ActionMapDescriptor<PlayerControlsType>,
): Entity {
  const world: NexusWorld = ctx.services.get(NEXUS);
  const entity: Entity = world.createEntity();

  world.addComponent(entity, PlayerInput, controls);
  world.addComponent(entity, MoveIntent);

  return entity;
}
