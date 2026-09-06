import type { StepContext, StepSet } from "@atlasjs/core";
import { Transform2D } from "@atlasjs/gameplay";
import { Vec2 } from "@atlasjs/math";
import type { Entity, NexusWorld, Query } from "@atlasjs/nexus";

import { PlayerStatus } from "../game/sim/PlayerStatus";
import { NetView } from "../game/view/NetView";
import {
  alphaBetween,
  extrapolationTicks,
  lerp,
  lerpAngle,
  SECONDS_PER_TICK,
} from "../net/interpolate";
import { PlayerFlags, SNAPSHOT_INTERVAL_TICKS } from "../net/protocol";
import type { PlayerWireState, ServerSnapshot } from "../net/protocol";
import type { SnapshotBracket, SnapshotBuffer } from "../net/SnapshotBuffer";

import type { NetId } from "../net/protocol";

export const APPLY_NET_STATE_STEP: string = "bump-royal:apply-net-state";

/* Two player diameters. Under it a correction is eased onto truth; over it the view has drifted
   far enough that easing would read as a slide across the arena, so the position is hard-set. */
export const SNAP_DISTANCE: number = 120;

/* One snapshot interval: the residual left by an extrapolation overshoot is down to a third
   after 50 ms and invisible after 150. */
const CORRECTION_TIME_CONSTANT: number =
  SNAPSHOT_INTERVAL_TICKS * SECONDS_PER_TICK;

function stateOf(
  snapshot: ServerSnapshot,
  id: NetId,
): PlayerWireState | undefined {
  for (const state of snapshot.p) {
    if (state.id === id) {
      return state;
    }
  }

  return undefined;
}

/* A raw scheduler step and not a NexusSystem, at update/Early: the four view scripts run at
   update/Logic, and they must read this frame's replicated state, not the previous one. */
export function registerApplyNetState(
  scheduler: StepSet,
  world: NexusWorld,
  buffer: SnapshotBuffer,
  now: () => number,
): void {
  const target: Vec2 = new Vec2();

  scheduler.add(
    "update",
    (ctx: StepContext): void => {
      const tick: number = buffer.renderTick(now());
      const bracket: SnapshotBracket | null = buffer.bracket(tick);

      if (bracket === null) {
        return;
      }

      const decay: number = Math.exp(-ctx.dt / CORRECTION_TIME_CONSTANT);

      const views: Query<[NetView, Transform2D, PlayerStatus]> = world.query(
        NetView,
        Transform2D,
        PlayerStatus,
      );

      views.each(
        (
          _entity: Entity,
          view: NetView,
          transform: Transform2D,
          status: PlayerStatus,
        ): void => {
          const from: PlayerWireState | undefined = stateOf(
            bracket.from,
            view.id,
          );

          /* A known id absent from a snapshot is left where it is. Despawning is what a leave
             message is for; a gap here is a straggler, not a departure. */
          if (from === undefined) {
            return;
          }

          const to: ServerSnapshot | null = bracket.to;
          const next: PlayerWireState | undefined =
            to === null ? undefined : stateOf(to, view.id);

          let angle: number;

          if (to === null || next === undefined) {
            const ticks: number = extrapolationTicks(bracket.from.t, tick);

            target.set(
              from.x + from.vx * ticks * SECONDS_PER_TICK,
              from.y + from.vy * ticks * SECONDS_PER_TICK,
            );

            angle = from.a;
            view.extrapolating = true;
            view.errorX = 0;
            view.errorY = 0;
          } else {
            const alpha: number = alphaBetween(bracket.from.t, to.t, tick);

            target.set(
              lerp(from.x, next.x, alpha),
              lerp(from.y, next.y, alpha),
            );

            angle = lerpAngle(from.a, next.a, alpha);

            if (view.extrapolating) {
              view.extrapolating = false;
              absorb(view, transform.position, target);
            }
          }

          view.errorX *= decay;
          view.errorY *= decay;

          transform.position.set(
            target.x + view.errorX,
            target.y + view.errorY,
          );

          /* Flags come from `from` and never from `to`: a state change has to land on the same
             frame as the position that goes with it, or a player reads as fallen while still
             visibly sliding towards the rim. */
          status.falling = (from.f & PlayerFlags.Falling) !== 0;
          status.facing.set(Math.cos(angle), Math.sin(angle));
        },
      );
    },
    {
      name: APPLY_NET_STATE_STEP,
      stage: "Early",
    },
  );
}

/* Snapping back to truth the instant a late snapshot lands would undo the extrapolation in one
   frame, which is the one thing the eye catches. Keeping the gap as a residual and decaying it
   lets the next interpolation pull the view onto truth over roughly one interval. */
function absorb(view: NetView, rendered: Vec2, corrected: Vec2): void {
  const dx: number = rendered.x - corrected.x;
  const dy: number = rendered.y - corrected.y;

  if (dx * dx + dy * dy >= SNAP_DISTANCE * SNAP_DISTANCE) {
    view.errorX = 0;
    view.errorY = 0;
    return;
  }

  view.errorX = dx;
  view.errorY = dy;
}
