import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { Transform2D } from "@atlasjs/gameplay";
import type { Vec2 } from "@atlasjs/math";

import { ARENA_BOUNDS, isInsideArena } from "../../src/game/sim/arena/bounds";
import { NetPlayer } from "../../src/game/sim/NetPlayer";
import { COLLIDER_RADIUS } from "../../src/game/sim/prefabs/buildPlayerSim";
import { MAX_PLAYERS } from "../../src/net/protocol";
import type { NetId } from "../../src/net/protocol";

import {
  GameRoom,
  SPAWN_MIN_SEPARATION,
  SPAWN_SLOTS,
} from "../../src/server/GameRoom";
import type { RoomPlayer } from "../../src/server/GameRoom";

import { createGameHarness } from "../helpers/engine";
import type { GameHarness } from "../helpers/engine";

const FIXED_DELTA: number = 1 / 60;

function requireJoin(room: GameRoom, name?: string): RoomPlayer {
  const player: RoomPlayer | null = room.join(name);

  if (player === null) {
    throw new Error("room refused a join it should have accepted");
  }

  return player;
}

function distance(
  a: readonly [number, number],
  b: readonly [number, number],
): number {
  return Math.hypot(a[0] - b[0], a[1] - b[1]);
}

describe("GameRoom", () => {
  let harness: GameHarness;
  let room: GameRoom;

  beforeEach(async () => {
    harness = await createGameHarness({ fixedDelta: FIXED_DELTA });
    room = new GameRoom(harness.engine.services);
  });

  afterEach(() => {
    harness.stop();
  });

  it("puts every spawn slot far enough inside the arena to hold a whole player", () => {
    expect(SPAWN_SLOTS).toHaveLength(MAX_PLAYERS);

    for (const slot of SPAWN_SLOTS) {
      expect(isInsideArena(ARENA_BOUNDS, slot, -COLLIDER_RADIUS)).toBe(true);
    }
  });

  it("spawns two joiners further apart than two colliders are wide", () => {
    const first: RoomPlayer = requireJoin(room);
    const second: RoomPlayer = requireJoin(room);

    expect(first.info.spawn).not.toEqual(second.info.spawn);
    expect(distance(first.info.spawn, second.info.spawn)).toBeGreaterThan(
      SPAWN_MIN_SEPARATION,
    );
  });

  it("skips a slot a live player is standing on", () => {
    const first: RoomPlayer = requireJoin(room);
    const blocked: Vec2 = SPAWN_SLOTS[1];

    harness.world
      .requireComponent(first.entity, Transform2D)
      .position.copyFrom(blocked);

    const second: RoomPlayer = requireJoin(room);

    expect(second.info.spawn).toEqual([SPAWN_SLOTS[2].x, SPAWN_SLOTS[2].y]);
  });

  it("refuses the player past MAX_PLAYERS instead of producing a snapshot the codec drops", () => {
    for (let i: number = 0; i < MAX_PLAYERS; i++) {
      requireJoin(room);
    }

    expect(room.size).toBe(MAX_PLAYERS);
    expect(room.join()).toBeNull();
    expect(room.size).toBe(MAX_PLAYERS);
  });

  it("never reissues a NetId, even after the entity index is recycled", () => {
    const first: RoomPlayer = requireJoin(room);
    room.leave(first.id);
    harness.frame();

    const second: RoomPlayer = requireJoin(room);

    expect(second.id).not.toBe(first.id);
    expect(second.id).toBeGreaterThan(first.id);
  });

  it("frees the room slot and the entity when a player leaves", () => {
    const player: RoomPlayer = requireJoin(room);

    expect(harness.world.query(NetPlayer).size).toBe(1);

    room.leave(player.id);
    harness.frame();

    expect(room.size).toBe(0);
    expect(room.get(player.id)).toBeUndefined();
    expect(harness.world.query(NetPlayer).size).toBe(0);
  });

  it("tags entities with the id the snapshot writer reads back", () => {
    const player: RoomPlayer = requireJoin(room);

    const tagged: NetId = harness.world.requireComponent(
      player.entity,
      NetPlayer,
    ).id;

    expect(tagged).toBe(player.id);
  });
});
