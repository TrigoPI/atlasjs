import { afterEach, describe, expect, it } from "vitest";

import { INSTANTIATOR, PhysicsBodyRef, Transform2D } from "@atlasjs/gameplay";
import type { GameEntity, Instantiator, Prefab } from "@atlasjs/gameplay";
import { Vec2 } from "@atlasjs/math";

import { MoveIntent } from "../../src/game/sim/MoveIntent";
import {
  COLLIDER_RADIUS,
  FALL_DURATION,
} from "../../src/game/sim/prefabs/buildPlayerSim";
import type { PlayerSimProps } from "../../src/game/sim/prefabs/buildPlayerSim";
import { createNetPlayerSimPrefab } from "../../src/game/sim/prefabs/NetPlayerSimPrefab";
import type { NetPlayerSimProps } from "../../src/game/sim/prefabs/NetPlayerSimPrefab";
import { createPlayerSimPrefab } from "../../src/game/sim/prefabs/PlayerSimPrefab";
import { ServerEventOutbox } from "../../src/net/EventOutbox";
import { toNetId } from "../../src/net/protocol";
import type {
  BumpEvent,
  FallEvent,
  RespawnEvent,
  ServerEvent,
} from "../../src/net/protocol";
import { registerEventClock } from "../../src/server/eventClock";

import { createGameHarness } from "../helpers/engine";
import type { GameHarness } from "../helpers/engine";

const FIXED_DELTA: number = 1 / 60;
const FALL_TICKS: number = Math.ceil(FALL_DURATION / FIXED_DELTA);

/* Just inside 2 * COLLIDER_RADIUS: the pair is already touching when the first step runs, so two
   such pairs report on the same tick by construction rather than by luck. */
const TOUCHING_GAP: number = 2 * COLLIDER_RADIUS - 1;

type Bots = {
  outbox: ServerEventOutbox;
  drained: ServerEvent[];
  spawnNet: (position: Vec2, netId: number) => GameEntity;
  spawnLocal: (position: Vec2) => GameEntity;
  run: (ticks: number, until?: () => boolean) => void;
};

async function bootBots(): Promise<{ harness: GameHarness; bots: Bots }> {
  const harness: GameHarness = await createGameHarness({
    fixedDelta: FIXED_DELTA,
  });

  const outbox: ServerEventOutbox = new ServerEventOutbox();
  registerEventClock(harness.scheduler, outbox);

  const instantiator: Instantiator = harness.engine.services.get(INSTANTIATOR);
  const netPrefab: Prefab<NetPlayerSimProps> = createNetPlayerSimPrefab();
  const localPrefab: Prefab<PlayerSimProps> = createPlayerSimPrefab();
  const drained: ServerEvent[] = [];

  const bots: Bots = {
    outbox,
    drained,

    spawnNet: (position: Vec2, netId: number): GameEntity =>
      instantiator.instantiate(netPrefab, {
        position,
        netId: toNetId(netId),
        outbox,
      }),

    /* No netId and no outbox: the offline shape, which has to stay inert. */
    spawnLocal: (position: Vec2): GameEntity =>
      instantiator.instantiate(localPrefab, { position }),

    /* Drained every tick the way registerWriteSnapshot drains it, so no spec ever inspects an
       event the server would already have sent. */
    run: (ticks: number, until?: () => boolean): void => {
      for (let i: number = 0; i < ticks; i++) {
        harness.frame();

        for (const event of outbox.drain()) {
          drained.push(event);
        }

        if (until !== undefined && until()) {
          return;
        }
      }
    },
  };

  return { harness, bots };
}

function bumps(events: readonly ServerEvent[]): BumpEvent[] {
  return events.filter((e: ServerEvent): e is BumpEvent => e.k === "bump");
}

function falls(events: readonly ServerEvent[]): FallEvent[] {
  return events.filter((e: ServerEvent): e is FallEvent => e.k === "fall");
}

function respawns(events: readonly ServerEvent[]): RespawnEvent[] {
  return events.filter(
    (e: ServerEvent): e is RespawnEvent => e.k === "respawn",
  );
}

function ascending(a: number, b: number): number {
  return a - b;
}

describe("server bump events", () => {
  const harnesses: GameHarness[] = [];

  async function boot(): Promise<Bots> {
    const booted: { harness: GameHarness; bots: Bots } = await bootBots();
    harnesses.push(booted.harness);
    return booted.bots;
  }

  afterEach(() => {
    for (const harness of harnesses) {
      harness.stop();
    }

    harnesses.length = 0;
  });

  /* onCollisionEnter fires once per direction per pair. Without the dedupe this reports two
     events for one bump, and the client plays two sounds. */
  it("reports one bump for a pair and not one per direction", async () => {
    const bots: Bots = await boot();

    bots.spawnNet(new Vec2(-TOUCHING_GAP / 2, 0), 1);
    bots.spawnNet(new Vec2(TOUCHING_GAP / 2, 0), 2);

    bots.run(30, (): boolean => bumps(bots.drained).length > 0);

    const reported: BumpEvent[] = bumps(bots.drained);

    expect(reported).toHaveLength(1);
    expect([reported[0].a, reported[0].b].sort(ascending)).toEqual([1, 2]);
  });

  it("puts the contact between the two centres and reports a positive impact speed", async () => {
    const bots: Bots = await boot();

    const left: GameEntity = bots.spawnNet(new Vec2(-80, 40), 1);
    const right: GameEntity = bots.spawnNet(new Vec2(80, 40), 2);

    left.requireComponent(MoveIntent).direction.set(1, 0);
    right.requireComponent(MoveIntent).direction.set(-1, 0);

    bots.run(120, (): boolean => bumps(bots.drained).length > 0);

    const reported: BumpEvent[] = bumps(bots.drained);

    expect(reported).toHaveLength(1);

    /* run() stops on the tick the bump was drained, so these are the centres of that tick. */
    const a: Vec2 = left.requireComponent(Transform2D).position;
    const b: Vec2 = right.requireComponent(Transform2D).position;
    const event: BumpEvent = reported[0];

    const midX: number = (a.x + b.x) / 2;
    const midY: number = (a.y + b.y) / 2;

    expect(Math.hypot(event.px - midX, event.py - midY)).toBeLessThan(
      COLLIDER_RADIUS,
    );

    expect(event.px).toBeGreaterThan(Math.min(a.x, b.x));
    expect(event.px).toBeLessThan(Math.max(a.x, b.x));
    expect(event.s).toBeGreaterThan(0);
  });

  /* The Collision handed to onCollisionEnter is one borrowed instance, re-targeted before every
     dispatch. A reporter that stored the object instead of reading point.x and point.y would put
     both of these events on the frame's last contact, and they would come out identical. */
  it("keeps two contacts in the same tick on their own points", async () => {
    const bots: Bots = await boot();

    bots.spawnNet(new Vec2(-200, 0), 1);
    bots.spawnNet(new Vec2(-200 + TOUCHING_GAP, 0), 2);
    bots.spawnNet(new Vec2(200, 0), 3);
    bots.spawnNet(new Vec2(200 + TOUCHING_GAP, 0), 4);

    bots.run(10, (): boolean => bumps(bots.drained).length >= 2);

    const reported: BumpEvent[] = bumps(bots.drained);

    expect(reported).toHaveLength(2);
    expect(reported[0].t).toBe(reported[1].t);
    expect(Math.abs(reported[0].px - reported[1].px)).toBeGreaterThan(
      2 * COLLIDER_RADIUS,
    );
  });

  it("reports one fall and one respawn a fall duration later", async () => {
    const bots: Bots = await boot();

    const bot: GameEntity = bots.spawnNet(new Vec2(0, 0), 1);

    bots.run(1);
    bot.requireComponent(PhysicsBodyRef).body.setTranslation(2000, 0);
    bots.run(FALL_TICKS + 4, (): boolean => respawns(bots.drained).length > 0);

    const fell: FallEvent[] = falls(bots.drained);
    const respawned: RespawnEvent[] = respawns(bots.drained);

    expect(fell).toHaveLength(1);
    expect(respawned).toHaveLength(1);
    expect(fell[0].id).toBe(1);
    expect(respawned[0].id).toBe(1);
    expect(respawned[0].t - fell[0].t).toBe(FALL_TICKS);
    expect(respawned[0].x).toBe(0);
    expect(respawned[0].y).toBe(0);
  });

  /* The offline prefab runs the same reporters against the null sink. If they ever started
     writing to a shared outbox, the local game would be feeding a server queue nobody drains. */
  it("stays silent for players built without a net id or an outbox", async () => {
    const bots: Bots = await boot();

    bots.spawnLocal(new Vec2(-TOUCHING_GAP / 2, 0));
    bots.spawnLocal(new Vec2(TOUCHING_GAP / 2, 0));

    const bot: GameEntity = bots.spawnLocal(new Vec2(0, 200));

    bots.run(1);
    bot.requireComponent(PhysicsBodyRef).body.setTranslation(2000, 0);
    bots.run(FALL_TICKS + 4);

    expect(bots.drained).toEqual([]);
    expect(bots.outbox.size).toBe(0);
  });
});
