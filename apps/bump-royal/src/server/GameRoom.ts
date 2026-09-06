import type { ServiceRegistry } from "@atlasjs/core";
import { INSTANTIATOR, Transform2D } from "@atlasjs/gameplay";
import type { GameEntity, Instantiator, Prefab } from "@atlasjs/gameplay";
import { Vec2 } from "@atlasjs/math";
import { NEXUS } from "@atlasjs/nexus";
import type { Entity, NexusWorld, Query } from "@atlasjs/nexus";

import { ARENA_BOUNDS, arenaVertices } from "../game/sim/arena/bounds";
import { NetPlayer } from "../game/sim/NetPlayer";
import { COLLIDER_RADIUS } from "../game/sim/prefabs/buildPlayerSim";
import { createNetPlayerSimPrefab } from "../game/sim/prefabs/NetPlayerSimPrefab";
import type { NetPlayerSimProps } from "../game/sim/prefabs/NetPlayerSimPrefab";
import { MAX_NAME_LENGTH, MAX_PLAYERS, toNetId } from "../net/protocol";
import type { NetId, PlayerInfo } from "../net/protocol";

const SPAWN_RADIUS_RATIO: number = 0.5;
const FIRST_NET_ID: number = 1;

/* Eight points inscribed in the octagon, each arena vertex pulled halfway back to the centre.
   Derived from ARENA_BOUNDS rather than written down, so resizing the arena cannot strand a
   spawn point on — or beyond — the rim. */
export const SPAWN_SLOTS: readonly Vec2[] = arenaVertices(ARENA_BOUNDS).map(
  (vertex: Vec2): Vec2 =>
    Vec2.create(
      ARENA_BOUNDS.center.x +
        (vertex.x - ARENA_BOUNDS.center.x) * SPAWN_RADIUS_RATIO,
      ARENA_BOUNDS.center.y +
        (vertex.y - ARENA_BOUNDS.center.y) * SPAWN_RADIUS_RATIO,
    ),
);

/* Two restitution-1 discs sharing a point leave the solver at an absurd speed, so a slot
   holding a live player is skipped rather than reused. */
export const SPAWN_MIN_SEPARATION: number = 2 * COLLIDER_RADIUS;

export type RoomPlayer = {
  readonly id: NetId;
  readonly entity: Entity;
  readonly info: PlayerInfo;
};

export class GameRoom {
  private readonly world: NexusWorld;
  private readonly instantiator: Instantiator;
  private readonly prefab: Prefab<NetPlayerSimProps>;
  private readonly players: Map<NetId, RoomPlayer>;

  /* Monotonic and never recycled: an Entity packs a generation and its index is reused, so a
     rejoin could otherwise hand a client an id that now addresses somebody else. */
  private nextNetId: number;
  private nextSlot: number;

  public constructor(services: ServiceRegistry) {
    this.world = services.get(NEXUS);
    this.instantiator = services.get(INSTANTIATOR);
    this.prefab = createNetPlayerSimPrefab();
    this.players = new Map<NetId, RoomPlayer>();
    this.nextNetId = FIRST_NET_ID;
    this.nextSlot = 0;
  }

  public get size(): number {
    return this.players.size;
  }

  public isFull(): boolean {
    return this.players.size >= MAX_PLAYERS;
  }

  public has(id: NetId): boolean {
    return this.players.has(id);
  }

  public get(id: NetId): RoomPlayer | undefined {
    return this.players.get(id);
  }

  public ids(): NetId[] {
    return [...this.players.keys()];
  }

  public roster(): PlayerInfo[] {
    return [...this.players.values()].map(
      (player: RoomPlayer): PlayerInfo => player.info,
    );
  }

  /* Returns null when the room is full instead of spawning a ninth player: the codec drops a
     whole snapshot whose player array is longer than MAX_PLAYERS, so an over-full room would
     freeze every client rather than degrade for the one that could not fit. */
  public join(name?: string): RoomPlayer | null {
    if (this.isFull()) {
      return null;
    }

    const id: NetId = toNetId(this.nextNetId++);
    const spawn: Vec2 = this.pickSpawn();

    const entity: GameEntity = this.instantiator.instantiate(this.prefab, {
      position: spawn,
      netId: id,
    });

    const player: RoomPlayer = {
      id,
      entity: entity.id,
      info: {
        id,
        /* A palette *index*, never an RGBA: what the players look like is a client concern,
           and shipping literal colours would make a re-skin a protocol change. */
        color: (id - FIRST_NET_ID) % MAX_PLAYERS,
        name: sanitizeName(name, id),
        spawn: [spawn.x, spawn.y],
      },
    };

    this.players.set(id, player);
    return player;
  }

  public leave(id: NetId): RoomPlayer | null {
    const player: RoomPlayer | undefined = this.players.get(id);

    if (player === undefined) {
      return null;
    }

    this.players.delete(id);
    this.instantiator.destroy(player.entity);
    return player;
  }

  public clear(): void {
    for (const id of this.ids()) {
      this.leave(id);
    }
  }

  private pickSpawn(): Vec2 {
    const occupied: Vec2[] = this.occupiedPositions();
    const slots: number = SPAWN_SLOTS.length;

    for (let offset: number = 0; offset < slots; offset++) {
      const index: number = (this.nextSlot + offset) % slots;
      const slot: Vec2 = SPAWN_SLOTS[index];

      if (isClear(slot, occupied)) {
        this.nextSlot = (index + 1) % slots;
        return slot.clone();
      }
    }

    /* MAX_PLAYERS equals the slot count, so every slot can only be blocked by players that
       have drifted off their own. Falling back keeps join total rather than refusing. */
    const fallback: Vec2 = SPAWN_SLOTS[this.nextSlot];
    this.nextSlot = (this.nextSlot + 1) % slots;
    return fallback.clone();
  }

  /* Read from the world, not from this.players: an entity destroyed by leave() is only really
     gone at the next command flush, and until then its body is still in the solver. */
  private occupiedPositions(): Vec2[] {
    const positions: Vec2[] = [];

    const query: Query<[NetPlayer, Transform2D]> = this.world.query(
      NetPlayer,
      Transform2D,
    );

    query.each(
      (_entity: Entity, _net: NetPlayer, transform: Transform2D): void => {
        positions.push(transform.position);
      },
    );

    return positions;
  }
}

function isClear(slot: Vec2, occupied: readonly Vec2[]): boolean {
  for (const position of occupied) {
    const dx: number = position.x - slot.x;
    const dy: number = position.y - slot.y;

    if (dx * dx + dy * dy < SPAWN_MIN_SEPARATION * SPAWN_MIN_SEPARATION) {
      return false;
    }
  }

  return true;
}

function sanitizeName(name: string | undefined, id: NetId): string {
  const fallback: string = `P${id}`;
  const trimmed: string = (name ?? "").trim();

  if (trimmed === "") {
    return fallback;
  }

  return trimmed.slice(0, MAX_NAME_LENGTH);
}
