import type { StepContext, StepSet } from "@atlasjs/core";
import type { Vec2 } from "@atlasjs/math";
import type { Entity, NexusWorld, Query } from "@atlasjs/nexus";

import { MoveIntent } from "../game/sim/MoveIntent";

const BOT_INTENT_STEP: string = "bump-royal:bot-intent";

export type BotIntentOptions = {
  direction: Vec2;
};

/* Temporary. This is the server-side stand-in for applyNetIntents: it occupies the same
   fixed/PreSim slot, and the transport task replaces it with the network inbox. Nothing
   else may write MoveIntent on the server — the scheduler is the only ordering authority,
   and a second producer would race it. */
export function registerBotIntentDriver(
  scheduler: StepSet,
  world: NexusWorld,
  options: BotIntentOptions,
): void {
  const direction: Vec2 = options.direction;

  scheduler.add(
    "fixed",
    (ctx: StepContext): void => {
      const intents: Query<[MoveIntent]> = world.query(MoveIntent);

      intents.each((_entity: Entity, intent: MoveIntent): void => {
        intent.direction.copyFrom(direction);
        intent.dash = false;
        intent.tick = ctx.tick;
      });
    },
    {
      name: BOT_INTENT_STEP,
      stage: "PreSim",
    },
  );
}
