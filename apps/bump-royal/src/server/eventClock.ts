import type { StepContext, StepSet } from "@atlasjs/core";

import type { ServerEventOutbox } from "../net/EventOutbox";

export const EVENT_CLOCK_STEP: string = "bump-royal:event-clock";

/* Neither onCollisionEnter nor onFixedUpdate is handed a tick, so the outbox carries it. PreSim
   (100) runs ahead of ScriptFixed (150) and of PhysicsWriteback (400), which is where the
   collision dispatch happens: every event a script pushes during a tick is stamped with it. */
export function registerEventClock(
  scheduler: StepSet,
  outbox: ServerEventOutbox,
): void {
  scheduler.add(
    "fixed",
    (ctx: StepContext): void => {
      outbox.stamp(ctx.tick);
    },
    { name: EVENT_CLOCK_STEP, stage: "PreSim" },
  );
}
