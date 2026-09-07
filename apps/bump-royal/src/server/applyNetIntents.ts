import type { StepContext, StepSet } from "@atlasjs/core";
import type { Entity, NexusWorld, Query } from "@atlasjs/nexus";

import { MoveIntent } from "../game/sim/MoveIntent";
import { NetPlayer } from "../game/sim/NetPlayer";

import type { ConsumedInput, InputInbox } from "./InputInbox";

export const APPLY_NET_INTENTS_STEP: string = "bump-royal:apply-net-intents";

/* A raw scheduler step and not a NexusSystem: registerSystem forwards { world, dt } only, and
   the tick this stamps into MoveIntent is what the snapshot's `ack` is measured against.

   The single producer of MoveIntent on the server, mirroring commitIntents offline. `dash` is
   set for exactly the one tick that consumes a frame carrying the edge — the inbox has already
   dropped the redundant copies, and a tick with no frame reports no dash. The dash *buffer*
   stays where it was, in PlayerMovementScript.dashRequested, so a dash pressed during the
   cooldown still fires the instant the cooldown ends. */
export function registerApplyNetIntents(
  scheduler: StepSet,
  world: NexusWorld,
  inbox: InputInbox,
): void {
  scheduler.add(
    "fixed",
    (ctx: StepContext): void => {
      const players: Query<[NetPlayer, MoveIntent]> = world.query(
        NetPlayer,
        MoveIntent,
      );

      players.each(
        (_entity: Entity, net: NetPlayer, intent: MoveIntent): void => {
          const input: ConsumedInput = inbox.consume(net.id);

          intent.direction.set(input.x, input.y).normalize();
          intent.dash = input.dash;
          intent.tick = ctx.tick;
        },
      );
    },
    {
      name: APPLY_NET_INTENTS_STEP,
      stage: "PreSim",
    },
  );
}
