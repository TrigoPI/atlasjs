import { afterEach, describe, expect, it } from "vitest";
import WebSocket from "ws";

import { PLAYER_MOVEMENT } from "../../src/game/sim/prefabs/buildPlayerSim";
import {
  PlayerFlags,
  PROTOCOL_VERSION,
  SNAPSHOT_INTERVAL_TICKS,
  TICK_HZ,
} from "../../src/net/protocol";
import type {
  NetId,
  PlayerInfo,
  PlayerWireState,
  ServerJoin,
  ServerLeave,
  ServerSnapshot,
  ServerWelcome,
} from "../../src/net/protocol";

import { createGameServer } from "../../src/server/createGameServer";
import type { GameServer } from "../../src/server/createGameServer";
import { SPAWN_MIN_SEPARATION } from "../../src/server/GameRoom";
import { CLOSE_PROTOCOL_ERROR } from "../../src/server/WebSocketTransport";

import { TestClient } from "../helpers/netClient";

const SNAPSHOT_HZ: number = TICK_HZ / SNAPSHOT_INTERVAL_TICKS;
const CADENCE_TOLERANCE_HZ: number = 2;
const CADENCE_SECONDS: number = 2;
const MS_PER_SECOND: number = 1000;

const INPUT_FRAMES: number = 60;
const MEASURE_TICKS: number = 30;
const DASH_OBSERVE_TICKS: number = 90;

const SLOW_TEST_MS: number = 30000;

let server: GameServer | null = null;
const clients: TestClient[] = [];

async function boot(): Promise<GameServer> {
  const started: GameServer = await createGameServer({
    port: 0,
    host: "127.0.0.1",
  });

  server = started;
  return started;
}

async function connect(name?: string): Promise<TestClient> {
  if (server === null) {
    throw new Error("server is not running");
  }

  const client: TestClient = await TestClient.connect(server.port, name);
  clients.push(client);

  await client.waitUntil(
    (): boolean => client.messages("welcome").length === 1,
    "welcome",
  );

  await client.waitUntil(
    (): boolean => client.snapshots().length >= 1,
    "first snapshot",
  );

  return client;
}

function welcomeOf(client: TestClient): ServerWelcome {
  return client.messages("welcome")[0];
}

function stateOf(snapshot: ServerSnapshot, id: NetId): PlayerWireState {
  const state: PlayerWireState | undefined = snapshot.p.find(
    (player: PlayerWireState): boolean => player.id === id,
  );

  if (state === undefined) {
    throw new Error(`snapshot ${snapshot.t} carries no player ${id}`);
  }

  return state;
}

function snapshotAtOrAfter(client: TestClient, tick: number): ServerSnapshot {
  const found: ServerSnapshot | undefined = client
    .snapshots()
    .find((snapshot: ServerSnapshot): boolean => snapshot.t >= tick);

  if (found === undefined) {
    throw new Error(`no snapshot at or after tick ${tick}`);
  }

  return found;
}

/* Velocity ramps at `acceleration` until it reaches `maxSpeed`, so the distance a held
   direction can cover in a window is an integral, not a number worth writing down. */
function reachableDistance(seconds: number): number {
  const rampSeconds: number =
    PLAYER_MOVEMENT.maxSpeed / PLAYER_MOVEMENT.acceleration;

  if (seconds <= rampSeconds) {
    return 0.5 * PLAYER_MOVEMENT.acceleration * seconds * seconds;
  }

  return (
    0.5 * PLAYER_MOVEMENT.maxSpeed * rampSeconds +
    (seconds - rampSeconds) * PLAYER_MOVEMENT.maxSpeed
  );
}

function dashRisingEdges(
  snapshots: readonly ServerSnapshot[],
  id: NetId,
): number {
  let edges: number = 0;
  let previous: boolean = false;

  for (const snapshot of snapshots) {
    const dashing: boolean =
      (stateOf(snapshot, id).f & PlayerFlags.Dashing) !== 0;

    if (dashing && !previous) {
      edges++;
    }

    previous = dashing;
  }

  return edges;
}

function fellDuring(snapshots: readonly ServerSnapshot[], id: NetId): boolean {
  return snapshots.some(
    (snapshot: ServerSnapshot): boolean =>
      (stateOf(snapshot, id).f & PlayerFlags.Falling) !== 0,
  );
}

function peakSpeed(snapshots: readonly ServerSnapshot[], id: NetId): number {
  let peak: number = 0;

  for (const snapshot of snapshots) {
    const state: PlayerWireState = stateOf(snapshot, id);
    peak = Math.max(peak, Math.hypot(state.vx, state.vy));
  }

  return peak;
}

function distanceBetween(
  a: readonly [number, number],
  b: readonly [number, number],
): number {
  return Math.hypot(a[0] - b[0], a[1] - b[1]);
}

describe("bump-royal server over a websocket", () => {
  afterEach(async () => {
    for (const client of clients) {
      await client.close();
    }

    clients.length = 0;

    await server?.close();
    server = null;
  });

  it("welcomes a client with its own id and the player list", async () => {
    await boot();
    const client: TestClient = await connect("alice");
    const welcome: ServerWelcome = welcomeOf(client);

    expect(welcome.hz).toBe(TICK_HZ);
    expect(welcome.snapEvery).toBe(SNAPSHOT_INTERVAL_TICKS);
    expect(welcome.players).toHaveLength(1);
    expect(welcome.players[0].id).toBe(welcome.you);
    expect(welcome.players[0].name).toBe("alice");
  });

  it(
    "broadcasts snapshots at the protocol's rate",
    async () => {
      await boot();
      const client: TestClient = await connect();
      const wanted: number = SNAPSHOT_HZ * CADENCE_SECONDS;

      await client.waitUntil(
        (): boolean => client.snapshots().length >= wanted,
        `${wanted} snapshots`,
      );

      const times: number[] = client.snapshotTimes();
      const span: number = times[times.length - 1] - times[0];
      const measured: number = ((times.length - 1) * MS_PER_SECOND) / span;

      expect(measured).toBeGreaterThan(SNAPSHOT_HZ - CADENCE_TOLERANCE_HZ);
      expect(measured).toBeLessThan(SNAPSHOT_HZ + CADENCE_TOLERANCE_HZ);
    },
    SLOW_TEST_MS,
  );

  it(
    "moves the sending player by a distance its own acceleration allows",
    async () => {
      await boot();
      const client: TestClient = await connect();
      const you: NetId = welcomeOf(client).you;

      const baseline: ServerSnapshot = client.lastSnapshot();
      const target: number = baseline.t + MEASURE_TICKS;
      const pumping: Promise<void> = client.pump({
        frames: INPUT_FRAMES,
        x: 1,
        y: 0,
      });

      await client.waitUntil(
        (): boolean => client.lastSnapshot().t >= target,
        `tick ${target}`,
      );

      await pumping;

      const after: ServerSnapshot = snapshotAtOrAfter(client, target);
      const seconds: number = (after.t - baseline.t) / TICK_HZ;
      const dx: number = stateOf(after, you).x - stateOf(baseline, you).x;

      expect(dx).toBeGreaterThan(reachableDistance(seconds) * 0.5);
      expect(dx).toBeLessThan(PLAYER_MOVEMENT.maxSpeed * seconds * 1.1);
    },
    SLOW_TEST_MS,
  );

  it(
    "announces a second player, replicates both, and drops back on leave",
    async () => {
      await boot();
      const alice: TestClient = await connect("alice");
      const bob: TestClient = await connect("bob");

      const bobId: NetId = welcomeOf(bob).you;

      await alice.waitUntil(
        (): boolean => alice.messages("join").length === 1,
        "join on alice",
      );

      const join: ServerJoin = alice.messages("join")[0];
      expect(join.player.id).toBe(bobId);
      expect(join.player.name).toBe("bob");

      await alice.waitUntil(
        (): boolean => alice.lastSnapshot().p.length === 2,
        "two players in a snapshot",
      );

      await bob.close();

      await alice.waitUntil(
        (): boolean => alice.messages("leave").length === 1,
        "leave on alice",
      );

      const leave: ServerLeave = alice.messages("leave")[0];
      expect(leave.id).toBe(bobId);

      await alice.waitUntil(
        (): boolean => alice.lastSnapshot().p.length === 1,
        "one player in a snapshot",
      );
    },
    SLOW_TEST_MS,
  );

  it("closes a socket whose hello speaks another protocol version", async () => {
    const started: GameServer = await boot();

    const socket: WebSocket = new WebSocket(`ws://127.0.0.1:${started.port}`);

    const code: number = await new Promise<number>(
      (
        resolve: (value: number) => void,
        reject: (error: Error) => void,
      ): void => {
        socket.once("error", reject);
        socket.once("open", (): void => {
          socket.send(JSON.stringify({ k: "hello", v: PROTOCOL_VERSION + 1 }));
        });
        socket.once("close", (closed: number): void => resolve(closed));
      },
    );

    expect(code).toBe(CLOSE_PROTOCOL_ERROR);
    expect(started.room.size).toBe(0);
  });

  it("gives two players spawn slots further apart than they are wide", async () => {
    await boot();
    await connect("alice");
    const bob: TestClient = await connect("bob");

    const roster: readonly PlayerInfo[] = welcomeOf(bob).players;
    expect(roster).toHaveLength(2);

    const [first, second]: readonly PlayerInfo[] = roster;
    expect(first.spawn).not.toEqual(second.spawn);
    expect(distanceBetween(first.spawn, second.spawn)).toBeGreaterThan(
      SPAWN_MIN_SEPARATION,
    );
  });

  it(
    "turns one dash edge sent with full redundancy into exactly one dash",
    async () => {
      await boot();
      const client: TestClient = await connect();
      const you: NetId = welcomeOf(client).you;

      const baseline: ServerSnapshot = client.lastSnapshot();
      const target: number = baseline.t + DASH_OBSERVE_TICKS;

      /* Inwards, then released: a dash aimed at the rim runs the player off the arena, and a
         fall clears PlayerMovementScript.dashRequested — which would hide a duplicate edge
         instead of exposing it. The two neutral frames are the key coming back up. */
      client.sendRedundant({ t: 0, x: -1, y: -1, d: true });
      client.send({ k: "input", f: [{ t: 1, x: 0, y: 0, d: false }], a: 0 });
      client.send({ k: "input", f: [{ t: 2, x: 0, y: 0, d: false }], a: 0 });

      await client.waitUntil(
        (): boolean => client.lastSnapshot().t >= target,
        `tick ${target}`,
      );

      /* Asserted on the wire rather than by instrumenting the server: the Dashing bit and the
         velocity are what a client sees, and a second edge would fire the buffered dash when
         the cooldown expires — well inside this window. */
      const observed: ServerSnapshot[] = client
        .snapshots()
        .filter((snapshot: ServerSnapshot): boolean => snapshot.t > baseline.t);

      expect(dashRisingEdges(observed, you)).toBe(1);
      expect(fellDuring(observed, you)).toBe(false);
      expect(peakSpeed(observed, you)).toBeGreaterThan(
        PLAYER_MOVEMENT.maxSpeed,
      );
    },
    SLOW_TEST_MS,
  );
});
