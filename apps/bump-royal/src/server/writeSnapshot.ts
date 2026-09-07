import type { StepContext, StepSet } from "@atlasjs/core";
import { RigidBody2D, Transform2D } from "@atlasjs/gameplay";
import type { Entity, NexusWorld, Query } from "@atlasjs/nexus";

import { NetPlayer } from "../game/sim/NetPlayer";
import { PlayerStatus } from "../game/sim/PlayerStatus";
import { PlayerFlags, SNAPSHOT_INTERVAL_TICKS } from "../net/protocol";
import type {
  NetId,
  PlayerWireState,
  ServerEvent,
  ServerSnapshot,
} from "../net/protocol";

export const WRITE_SNAPSHOT_STEP: string = "bump-royal:write-snapshot";

const NEXUS_FLUSH_STEP: string = "nexus:flush";

export type SnapshotSink = {
  recipients: () => readonly NetId[];
  ackFor: (id: NetId) => number;
  drainEvents: () => readonly ServerEvent[];
  send: (id: NetId, snapshot: ServerSnapshot) => void;
};

function byId(a: PlayerWireState, b: PlayerWireState): number {
  return a.id - b.id;
}

function flagsOf(status: PlayerStatus): number {
  const falling: number = status.falling ? PlayerFlags.Falling : 0;
  const dashing: number = status.dashRemaining > 0 ? PlayerFlags.Dashing : 0;

  return falling | dashing;
}

/* A raw scheduler step and not a NexusSystem: registerSystem forwards { world, dt } only, and
   both the 20 Hz gate and the snapshot's own `t` are the tick.

   Stage Sync (1000), after nexus:flush: PhysicsWriteback (400) must already have written this
   tick's positions, and the flush is what actually removes an entity that leave() destroyed —
   snapshotting before it would replicate a player the room has already dropped. */
export function registerWriteSnapshot(
  scheduler: StepSet,
  world: NexusWorld,
  sink: SnapshotSink,
): void {
  scheduler.add(
    "fixed",
    (ctx: StepContext): void => {
      if (ctx.tick % SNAPSHOT_INTERVAL_TICKS !== 0) {
        return;
      }

      /* Drained before the recipient check, never after: an empty room still has to empty the
         outbox, or the first client to connect inherits every bump since the server booted. */
      const events: readonly ServerEvent[] = sink.drainEvents();
      const recipients: readonly NetId[] = sink.recipients();

      if (recipients.length === 0) {
        return;
      }

      const states: PlayerWireState[] = [];

      const players: Query<
        [NetPlayer, Transform2D, RigidBody2D, PlayerStatus]
      > = world.query(NetPlayer, Transform2D, RigidBody2D, PlayerStatus);

      players.each(
        (
          _entity: Entity,
          net: NetPlayer,
          transform: Transform2D,
          body: RigidBody2D,
          status: PlayerStatus,
        ): void => {
          states.push({
            id: net.id,
            x: transform.position.x,
            y: transform.position.y,
            vx: body.velocity.x,
            vy: body.velocity.y,
            a: status.facing.angle(),
            f: flagsOf(status),
          });
        },
      );

      states.sort(byId);

      /* `ack` is the last input tick the simulation consumed from *this* recipient, so the
         snapshot is encoded once per client. Prediction will read it; do not hoist it. */
      for (const id of recipients) {
        const ack: number = sink.ackFor(id);

        sink.send(
          id,
          events.length === 0
            ? { k: "snap", t: ctx.tick, ack, p: states }
            : { k: "snap", t: ctx.tick, ack, p: states, e: events },
        );
      }
    },
    {
      name: WRITE_SNAPSHOT_STEP,
      stage: "Sync",
      after: NEXUS_FLUSH_STEP,
    },
  );
}
