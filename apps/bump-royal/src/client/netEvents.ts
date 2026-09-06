import type { StepSet } from "@atlasjs/core";
import { Transform2D } from "@atlasjs/gameplay";
import type { ScriptManager } from "@atlasjs/gameplay";
import type { Entity, NexusWorld } from "@atlasjs/nexus";

import { PlayerStatus } from "../game/sim/PlayerStatus";
import { NetView } from "../game/view/NetView";
import {
  PlayerCollisionScript,
  PlayerFallViewScript,
  PlayerSoundScript,
} from "../game/view/script/player";
import type { BumpEvent, NetId, RespawnEvent } from "../net/protocol";
import type { ServerEvent } from "../net/protocol";
import type { SnapshotBuffer } from "../net/SnapshotBuffer";

import { APPLY_NET_STATE_STEP } from "./applyNetState";
import type { NetEventQueue } from "./NetEventQueue";

export const NET_EVENTS_STEP: string = "bump-royal:net-events";

type ViewIndex = Map<NetId, Entity>;

function indexViews(world: NexusWorld): ViewIndex {
  const index: ViewIndex = new Map<NetId, Entity>();

  world.query(NetView).each((entity: Entity, view: NetView): void => {
    index.set(view.id, entity);
  });

  return index;
}

function applyBump(
  scripts: ScriptManager,
  index: ViewIndex,
  event: BumpEvent,
): void {
  const a: Entity | undefined = index.get(event.a);
  const b: Entity | undefined = index.get(event.b);

  squish(scripts, a, event);
  squish(scripts, b, event);

  /* One sound for the pair, matching offline: the simulation's pair dedupe means a collision
     produces a single playOneShot there too. `a` is the reporter, so it is the one that speaks;
     when it has already left, `b` covers for it. */
  const speaker: Entity | undefined = a ?? b;

  if (speaker === undefined) {
    return;
  }

  scripts.getScript(speaker, PlayerSoundScript)?.playBump(event.s);
}

function squish(
  scripts: ScriptManager,
  entity: Entity | undefined,
  event: BumpEvent,
): void {
  if (entity === undefined) {
    return;
  }

  scripts
    .getScript(entity, PlayerCollisionScript)
    ?.playBump(event.px, event.py);
}

/* A hard position set and not a correction to absorb: the pre-respawn snapshot still has this
   player off the arena, and easing onto the spawn point would drag a shrinking ghost across the
   slab. The tick is recorded on NetView so the applier stops interpolating from that snapshot
   too — this write alone would be undone on the next frame. */
function applyRespawn(
  world: NexusWorld,
  scripts: ScriptManager,
  index: ViewIndex,
  event: RespawnEvent,
): void {
  const entity: Entity | undefined = index.get(event.id);

  if (entity === undefined) {
    return;
  }

  const view: NetView | undefined = world.getComponent(entity, NetView);
  const transform: Transform2D | undefined = world.getComponent(
    entity,
    Transform2D,
  );

  const status: PlayerStatus | undefined = world.getComponent(
    entity,
    PlayerStatus,
  );

  if (view === undefined || transform === undefined || status === undefined) {
    return;
  }

  view.teleportTick = event.t;
  view.teleportX = event.x;
  view.teleportY = event.y;
  view.errorX = 0;
  view.errorY = 0;

  transform.position.set(event.x, event.y);
  status.falling = false;

  scripts.getScript(entity, PlayerFallViewScript)?.playRespawn();
}

function applyEvent(
  world: NexusWorld,
  scripts: ScriptManager,
  index: ViewIndex,
  event: ServerEvent,
): void {
  switch (event.k) {
    case "bump":
      applyBump(scripts, index, event);
      return;

    case "fall": {
      const entity: Entity | undefined = index.get(event.id);

      if (entity !== undefined) {
        scripts.getScript(entity, PlayerFallViewScript)?.playFall();
      }

      return;
    }

    case "respawn":
      applyRespawn(world, scripts, index, event);
      return;
  }
}

/* update/Early after the snapshot applier: a bump anchors its dust on the difference between the
   contact point and the player's rendered position, so that position has to be this frame's. */
export function registerNetEvents(
  scheduler: StepSet,
  world: NexusWorld,
  scripts: ScriptManager,
  buffer: SnapshotBuffer,
  queue: NetEventQueue,
  now: () => number,
): void {
  const due: ServerEvent[] = [];

  scheduler.add(
    "update",
    (): void => {
      due.length = 0;

      queue.drain(buffer.renderTick(now()), (event: ServerEvent): void => {
        due.push(event);
      });

      if (due.length === 0) {
        return;
      }

      const index: ViewIndex = indexViews(world);

      for (const event of due) {
        applyEvent(world, scripts, index, event);
      }
    },
    {
      name: NET_EVENTS_STEP,
      stage: "Early",
      after: APPLY_NET_STATE_STEP,
    },
  );
}
