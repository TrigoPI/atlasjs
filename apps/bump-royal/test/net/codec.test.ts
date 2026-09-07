import { describe, expect, it } from "vitest";
import { randomRange } from "@atlasjs/utils";

import {
  INPUT_REDUNDANCY,
  MAX_EVENTS_PER_SNAPSHOT,
  MAX_NAME_LENGTH,
  MAX_PLAYERS,
  PROTOCOL_VERSION,
  PlayerFlags,
  SNAPSHOT_INTERVAL_TICKS,
  TICK_HZ,
  decodeClient,
  decodeServer,
  encodeClient,
  encodeServer,
  toNetId,
} from "../../src/net";
import type {
  ClientHello,
  ClientInput,
  ClientMessage,
  PlayerInfo,
  PlayerWireState,
  ServerEvent,
  ServerJoin,
  ServerLeave,
  ServerMessage,
  ServerSnapshot,
  ServerWelcome,
} from "../../src/net";

function decodedClient(raw: string): ClientMessage {
  const decoded: ClientMessage | null = decodeClient(raw);
  expect(decoded).not.toBeNull();
  if (decoded === null) throw new Error("unreachable: assertion above failed");
  return decoded;
}

function decodedServer(raw: string): ServerMessage {
  const decoded: ServerMessage | null = decodeServer(raw);
  expect(decoded).not.toBeNull();
  if (decoded === null) throw new Error("unreachable: assertion above failed");
  return decoded;
}

function roundTripClient(msg: ClientMessage, expected: ClientMessage): void {
  const wire: string = encodeClient(msg);
  const decoded: ClientMessage = decodedClient(wire);

  expect(decoded).toStrictEqual(expected);
  expect(encodeClient(decoded)).toBe(wire);
}

function roundTripServer(msg: ServerMessage, expected: ServerMessage): void {
  const wire: string = encodeServer(msg);
  const decoded: ServerMessage = decodedServer(wire);

  expect(decoded).toStrictEqual(expected);
  expect(encodeServer(decoded)).toBe(wire);
}

function rejects(decode: (raw: string) => unknown, raw: string): void {
  expect(() => decode(raw)).not.toThrow();
  expect(decode(raw)).toBeNull();
}

const PLAYER_A: PlayerInfo = {
  id: toNetId(0),
  color: 3,
  name: "alice",
  spawn: [120.5, -40.25],
};

const PLAYER_B: PlayerInfo = {
  id: toNetId(1),
  color: 5,
  name: "bob",
  spawn: [-120.5, 40.25],
};

const STATE_A: PlayerWireState = {
  id: toNetId(0),
  x: 12.34,
  y: -56.78,
  vx: 300.5,
  vy: -0.25,
  a: 1.571,
  f: PlayerFlags.Dashing,
};

describe("protocol constants", () => {
  it("pins the values the whole series is sized against", () => {
    expect(PROTOCOL_VERSION).toBe(1);
    expect(TICK_HZ).toBe(60);
    expect(SNAPSHOT_INTERVAL_TICKS).toBe(3);
    expect(TICK_HZ / SNAPSHOT_INTERVAL_TICKS).toBe(20);
    expect(INPUT_REDUNDANCY).toBe(3);
    expect(MAX_PLAYERS).toBe(8);
  });

  it("keeps the flags a disjoint bitfield", () => {
    expect(PlayerFlags.None).toBe(0);
    expect(PlayerFlags.Falling & PlayerFlags.Dashing).toBe(0);
  });
});

describe("client message round trip", () => {
  it("round trips a hello carrying a name", () => {
    const hello: ClientHello = { k: "hello", v: PROTOCOL_VERSION, name: "zoe" };
    roundTripClient(hello, hello);
  });

  it("round trips a hello without a name, keeping the key absent", () => {
    const hello: ClientHello = { k: "hello", v: PROTOCOL_VERSION };
    roundTripClient(hello, hello);

    const decoded: ClientMessage = decodedClient(encodeClient(hello));
    expect("name" in decoded).toBe(false);
  });

  it("round trips an input carrying the redundancy window", () => {
    const input: ClientInput = {
      k: "input",
      a: 41,
      f: [
        { t: 42, x: -1, y: 0, d: false },
        { t: 43, x: 0, y: 1, d: true },
        { t: 44, x: 1, y: -1, d: false },
      ],
    };
    expect(input.f.length).toBe(INPUT_REDUNDANCY);
    roundTripClient(input, input);
  });

  it("round trips an input with an empty frame window", () => {
    const input: ClientInput = { k: "input", a: 0, f: [] };
    roundTripClient(input, input);
  });
});

describe("server message round trip", () => {
  it("round trips a welcome", () => {
    const welcome: ServerWelcome = {
      k: "welcome",
      v: PROTOCOL_VERSION,
      you: toNetId(1),
      tick: 1234,
      hz: TICK_HZ,
      snapEvery: SNAPSHOT_INTERVAL_TICKS,
      players: [PLAYER_A, PLAYER_B],
    };
    roundTripServer(welcome, welcome);
  });

  it("round trips a welcome into an empty room", () => {
    const welcome: ServerWelcome = {
      k: "welcome",
      v: PROTOCOL_VERSION,
      you: toNetId(0),
      tick: 0,
      hz: TICK_HZ,
      snapEvery: SNAPSHOT_INTERVAL_TICKS,
      players: [],
    };
    roundTripServer(welcome, welcome);
  });

  it("round trips a join", () => {
    const join: ServerJoin = { k: "join", tick: 90, player: PLAYER_B };
    roundTripServer(join, join);
  });

  it("round trips a leave", () => {
    const leave: ServerLeave = { k: "leave", tick: 91, id: toNetId(1) };
    roundTripServer(leave, leave);
  });

  it("round trips a snapshot carrying all three event kinds", () => {
    const events: readonly ServerEvent[] = [
      {
        k: "bump",
        t: 300,
        a: toNetId(0),
        b: toNetId(1),
        px: 10.5,
        py: -20.25,
        s: 640.75,
      },
      { k: "fall", t: 301, id: toNetId(1) },
      { k: "respawn", t: 302, id: toNetId(1), x: 0, y: -200.5 },
    ];
    const snap: ServerSnapshot = {
      k: "snap",
      t: 303,
      ack: 300,
      p: [STATE_A],
      e: events,
    };
    roundTripServer(snap, snap);
  });

  it("round trips an empty snapshot with no events, keeping the key absent", () => {
    const snap: ServerSnapshot = { k: "snap", t: 12, ack: 9, p: [] };
    roundTripServer(snap, snap);

    const decoded: ServerMessage = decodedServer(encodeServer(snap));
    expect("e" in decoded).toBe(false);
    expect(decoded).toStrictEqual({ k: "snap", t: 12, ack: 9, p: [] });
  });

  it("round trips a snapshot with an explicitly empty event list", () => {
    const snap: ServerSnapshot = { k: "snap", t: 12, ack: 9, p: [], e: [] };
    roundTripServer(snap, snap);
  });

  it("round trips a full room", () => {
    const players: PlayerWireState[] = [];
    for (let i: number = 0; i < MAX_PLAYERS; i++) {
      players.push({
        id: toNetId(i),
        x: i * 10,
        y: -5 - i * 10,
        vx: 0,
        vy: 0,
        a: 0,
        f: PlayerFlags.None,
      });
    }
    const snap: ServerSnapshot = { k: "snap", t: 60, ack: 57, p: players };
    roundTripServer(snap, snap);
  });
});

describe("encode rounding", () => {
  it("rounds positions and velocities to two decimals", () => {
    const snap: ServerSnapshot = {
      k: "snap",
      t: 1,
      ack: 0,
      p: [
        {
          id: toNetId(0),
          x: 1.23456,
          y: -1.23456,
          vx: 987.65432,
          vy: -0.005,
          a: 0,
          f: PlayerFlags.None,
        },
      ],
    };
    const decoded: ServerMessage = decodedServer(encodeServer(snap));
    if (decoded.k !== "snap") throw new Error("expected a snapshot");

    expect(decoded.p[0].x).toBe(1.23);
    expect(decoded.p[0].y).toBe(-1.23);
    expect(decoded.p[0].vx).toBe(987.65);
    expect(decoded.p[0].vy).toBe(0);
    expect(Object.is(decoded.p[0].vy, -0)).toBe(false);
  });

  it("normalises negative zero, which JSON.stringify writes as 0 anyway", () => {
    const snap: ServerSnapshot = {
      k: "snap",
      t: 1,
      ack: 0,
      p: [{ ...STATE_A, x: -0, y: -0.001, a: -0.0001 }],
    };
    const decoded: ServerMessage = decodedServer(encodeServer(snap));
    if (decoded.k !== "snap") throw new Error("expected a snapshot");

    expect(Object.is(decoded.p[0].x, -0)).toBe(false);
    expect(Object.is(decoded.p[0].y, -0)).toBe(false);
    expect(Object.is(decoded.p[0].a, -0)).toBe(false);
    expect(encodeServer(decoded)).toBe(encodeServer(snap));
  });

  it("rounds the facing angle to three decimals, not two", () => {
    const snap: ServerSnapshot = {
      k: "snap",
      t: 1,
      ack: 0,
      p: [
        {
          id: toNetId(0),
          x: 0,
          y: 0,
          vx: 0,
          vy: 0,
          a: Math.PI,
          f: PlayerFlags.None,
        },
      ],
    };
    const decoded: ServerMessage = decodedServer(encodeServer(snap));
    if (decoded.k !== "snap") throw new Error("expected a snapshot");

    expect(decoded.p[0].a).toBe(3.142);
  });

  it("rounds spawn coordinates and bump payloads", () => {
    const join: ServerJoin = {
      k: "join",
      tick: 5,
      player: { ...PLAYER_A, spawn: [1.23456, -9.87654] },
    };
    const decodedJoin: ServerMessage = decodedServer(encodeServer(join));
    if (decodedJoin.k !== "join") throw new Error("expected a join");
    expect(decodedJoin.player.spawn).toStrictEqual([1.23, -9.88]);

    const snap: ServerSnapshot = {
      k: "snap",
      t: 5,
      ack: 2,
      p: [],
      e: [
        {
          k: "bump",
          t: 4,
          a: toNetId(0),
          b: toNetId(1),
          px: 1.23456,
          py: 2.34567,
          s: 3.45678,
        },
      ],
    };
    const decodedSnap: ServerMessage = decodedServer(encodeServer(snap));
    if (decodedSnap.k !== "snap") throw new Error("expected a snapshot");
    expect(decodedSnap.e?.[0]).toStrictEqual({
      k: "bump",
      t: 4,
      a: 0,
      b: 1,
      px: 1.23,
      py: 2.35,
      s: 3.46,
    });
  });

  it("leaves ticks and bitfields untouched", () => {
    const snap: ServerSnapshot = {
      k: "snap",
      t: 999999,
      ack: 999996,
      p: [{ ...STATE_A, f: PlayerFlags.Falling | PlayerFlags.Dashing }],
    };
    const decoded: ServerMessage = decodedServer(encodeServer(snap));
    if (decoded.k !== "snap") throw new Error("expected a snapshot");

    expect(decoded.t).toBe(999999);
    expect(decoded.ack).toBe(999996);
    expect(decoded.p[0].f).toBe(3);
  });
});

describe("decoder never throws on hostile input", () => {
  const structurallyBroken: readonly string[] = [
    "",
    "{",
    "}{",
    '{"k":',
    "undefined",
    "null",
    "42",
    '"snap"',
    "true",
    "[]",
    '["snap",1,2]',
    '{"k":"nope"}',
    '{"k":42}',
    "{}",
  ];

  it("rejects structurally broken payloads on both directions", () => {
    for (const raw of structurallyBroken) {
      rejects(decodeClient, raw);
      rejects(decodeServer, raw);
    }
  });

  it("rejects a message aimed at the other direction", () => {
    const snap: ServerSnapshot = { k: "snap", t: 1, ack: 0, p: [] };
    const hello: ClientHello = { k: "hello", v: PROTOCOL_VERSION };

    rejects(decodeClient, encodeServer(snap));
    rejects(decodeServer, encodeClient(hello));
  });

  it("never lets a payload pollute Object.prototype", () => {
    const raw: string =
      '{"k":"snap","t":1,"ack":0,"p":[],"__proto__":{"polluted":true}}';
    expect(() => decodeServer(raw)).not.toThrow();

    const probe: Record<string, unknown> = {};
    expect(probe.polluted).toBeUndefined();
  });
});

describe("client decoder validation", () => {
  it("rejects a hello whose version is not the protocol version", () => {
    rejects(decodeClient, '{"k":"hello","v":2}');
    rejects(decodeClient, `{"k":"hello","v":${PROTOCOL_VERSION - 1}}`);
    rejects(decodeClient, '{"k":"hello","v":"1"}');
    rejects(decodeClient, '{"k":"hello"}');
  });

  it("rejects a hello whose name is not a bounded string", () => {
    rejects(decodeClient, '{"k":"hello","v":1,"name":7}');
    rejects(decodeClient, '{"k":"hello","v":1,"name":null}');
    rejects(
      decodeClient,
      `{"k":"hello","v":1,"name":"${"x".repeat(MAX_NAME_LENGTH + 1)}"}`,
    );
  });

  it("accepts a hello whose name sits exactly on the bound", () => {
    const name: string = "x".repeat(MAX_NAME_LENGTH);
    const decoded: ClientMessage = decodedClient(
      `{"k":"hello","v":1,"name":"${name}"}`,
    );
    expect(decoded).toStrictEqual({ k: "hello", v: 1, name });
  });

  it("rejects an input carrying more frames than the redundancy window", () => {
    const frames: string = Array.from(
      { length: INPUT_REDUNDANCY + 1 },
      (_unused: unknown, i: number) => `{"t":${i},"x":0,"y":0,"d":false}`,
    ).join(",");
    rejects(decodeClient, `{"k":"input","a":0,"f":[${frames}]}`);
  });

  it("rejects an axis outside -1, 0, 1", () => {
    rejects(
      decodeClient,
      '{"k":"input","a":0,"f":[{"t":1,"x":2,"y":0,"d":false}]}',
    );
    rejects(
      decodeClient,
      '{"k":"input","a":0,"f":[{"t":1,"x":0,"y":-2,"d":false}]}',
    );
    rejects(
      decodeClient,
      '{"k":"input","a":0,"f":[{"t":1,"x":0.5,"y":0,"d":false}]}',
    );
    rejects(
      decodeClient,
      '{"k":"input","a":0,"f":[{"t":1,"x":"1","y":0,"d":false}]}',
    );
  });

  it("rejects an input whose fields are missing or wrongly typed", () => {
    rejects(decodeClient, '{"k":"input","a":0}');
    rejects(decodeClient, '{"k":"input","a":0,"f":{}}');
    rejects(decodeClient, '{"k":"input","f":[]}');
    rejects(decodeClient, '{"k":"input","a":"0","f":[]}');
    rejects(decodeClient, '{"k":"input","a":0.5,"f":[]}');
    rejects(decodeClient, '{"k":"input","a":0,"f":[null]}');
    rejects(decodeClient, '{"k":"input","a":0,"f":[{"t":1,"x":0,"y":0}]}');
    rejects(
      decodeClient,
      '{"k":"input","a":0,"f":[{"t":1,"x":0,"y":0,"d":1}]}',
    );
  });

  it("rejects non-finite numbers reached through 1e999", () => {
    expect(JSON.parse("1e999")).toBe(Number.POSITIVE_INFINITY);

    rejects(decodeClient, '{"k":"input","a":1e999,"f":[]}');
    rejects(
      decodeClient,
      '{"k":"input","a":0,"f":[{"t":1e999,"x":0,"y":0,"d":false}]}',
    );
    rejects(
      decodeClient,
      '{"k":"input","a":0,"f":[{"t":-1e999,"x":0,"y":0,"d":false}]}',
    );
  });
});

describe("server decoder validation", () => {
  const wireState = (overrides: string): string =>
    `{"id":0,"x":0,"y":0,"vx":0,"vy":0,"a":0,"f":0,${overrides}}`;

  it("rejects a snapshot whose required fields are missing or wrongly typed", () => {
    rejects(decodeServer, '{"k":"snap","ack":0,"p":[]}');
    rejects(decodeServer, '{"k":"snap","t":1,"p":[]}');
    rejects(decodeServer, '{"k":"snap","t":1,"ack":0}');
    rejects(decodeServer, '{"k":"snap","t":1,"ack":0,"p":{}}');
    rejects(decodeServer, '{"k":"snap","t":"1","ack":0,"p":[]}');
    rejects(decodeServer, '{"k":"snap","t":1.5,"ack":0,"p":[]}');
    rejects(decodeServer, '{"k":"snap","t":1,"ack":0,"p":[null]}');
    rejects(decodeServer, '{"k":"snap","t":1,"ack":0,"p":[],"e":{}}');
    rejects(
      decodeServer,
      '{"k":"snap","t":1,"ack":0,"p":[],"e":[{"k":"nope"}]}',
    );
  });

  it("rejects a player state whose numbers are non-finite", () => {
    rejects(
      decodeServer,
      `{"k":"snap","t":1,"ack":0,"p":[${wireState('"x":1e999')}]}`,
    );
    rejects(
      decodeServer,
      `{"k":"snap","t":1,"ack":0,"p":[${wireState('"vy":-1e999')}]}`,
    );
    rejects(
      decodeServer,
      `{"k":"snap","t":1,"ack":0,"p":[${wireState('"a":1e999')}]}`,
    );
  });

  it("rejects a player state whose id or bitfield is not a non-negative integer", () => {
    rejects(
      decodeServer,
      `{"k":"snap","t":1,"ack":0,"p":[${wireState('"id":-1')}]}`,
    );
    rejects(
      decodeServer,
      `{"k":"snap","t":1,"ack":0,"p":[${wireState('"id":1.5')}]}`,
    );
    rejects(
      decodeServer,
      `{"k":"snap","t":1,"ack":0,"p":[${wireState('"f":-1')}]}`,
    );
    rejects(
      decodeServer,
      `{"k":"snap","t":1,"ack":0,"p":[${wireState('"f":"1"')}]}`,
    );
  });

  it("rejects a snapshot carrying more players than the room can hold", () => {
    const states: string = Array.from({ length: MAX_PLAYERS + 1 }, () =>
      wireState('"id":0'),
    ).join(",");
    rejects(decodeServer, `{"k":"snap","t":1,"ack":0,"p":[${states}]}`);
  });

  it("rejects a snapshot carrying an absurd number of events", () => {
    const events: string = Array.from(
      { length: MAX_EVENTS_PER_SNAPSHOT + 1 },
      () => '{"k":"fall","t":1,"id":0}',
    ).join(",");
    rejects(decodeServer, `{"k":"snap","t":1,"ack":0,"p":[],"e":[${events}]}`);
  });

  it("rejects malformed events of every kind", () => {
    const snapWith = (event: string): string =>
      `{"k":"snap","t":1,"ack":0,"p":[],"e":[${event}]}`;

    rejects(
      decodeServer,
      snapWith('{"k":"bump","t":1,"a":0,"b":1,"px":0,"py":0}'),
    );
    rejects(
      decodeServer,
      snapWith('{"k":"bump","t":1,"a":0,"b":1,"px":1e999,"py":0,"s":0}'),
    );
    rejects(
      decodeServer,
      snapWith('{"k":"bump","t":1,"a":-1,"b":1,"px":0,"py":0,"s":0}'),
    );
    rejects(decodeServer, snapWith('{"k":"fall","t":1}'));
    rejects(decodeServer, snapWith('{"k":"fall","t":"1","id":0}'));
    rejects(decodeServer, snapWith('{"k":"respawn","t":1,"id":0,"x":0}'));
    rejects(
      decodeServer,
      snapWith('{"k":"respawn","t":1,"id":0,"x":0,"y":null}'),
    );
  });

  it("rejects a welcome whose handshake numbers are unusable", () => {
    const welcome = (overrides: string): string =>
      `{"k":"welcome","v":1,"you":0,"tick":0,"hz":60,"snapEvery":3,"players":[],${overrides}}`;

    rejects(decodeServer, welcome('"hz":0'));
    rejects(decodeServer, welcome('"snapEvery":0'));
    rejects(decodeServer, welcome('"hz":-60'));
    rejects(decodeServer, welcome('"you":-1'));
    rejects(decodeServer, welcome('"tick":1e999'));
    rejects(decodeServer, welcome('"players":{}'));
    rejects(decodeServer, welcome('"v":"1"'));
  });

  it("rejects a player info whose fields are malformed", () => {
    const info = (overrides: string): string =>
      `{"k":"join","tick":1,"player":{"id":0,"color":0,"name":"a","spawn":[0,0],${overrides}}}`;

    rejects(decodeServer, info('"spawn":[0]'));
    rejects(decodeServer, info('"spawn":[0,0,0]'));
    rejects(decodeServer, info('"spawn":{}'));
    rejects(decodeServer, info('"spawn":[0,1e999]'));
    rejects(decodeServer, info('"spawn":["0","0"]'));
    rejects(decodeServer, info('"color":-1'));
    rejects(decodeServer, info('"name":null'));
    rejects(decodeServer, '{"k":"join","tick":1}');
    rejects(decodeServer, '{"k":"leave","tick":1}');
    rejects(decodeServer, '{"k":"leave","id":0}');
  });

  it("accepts a welcome whose version differs, leaving the mismatch to the caller", () => {
    const decoded: ServerMessage = decodedServer(
      '{"k":"welcome","v":99,"you":0,"tick":0,"hz":60,"snapEvery":3,"players":[]}',
    );
    if (decoded.k !== "welcome") throw new Error("expected a welcome");
    expect(decoded.v).toBe(99);
    expect(decoded.v === PROTOCOL_VERSION).toBe(false);
  });
});

function mulberry32(seed: number): () => number {
  let state: number = seed >>> 0;
  return (): number => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t: number = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function roundLike(value: number, precision: number): number {
  const rounded: number = Math.round(value * precision) / precision;
  return rounded === 0 ? 0 : rounded;
}

function randomSnapshot(rng: () => number, tick: number): ServerSnapshot {
  const count: number = 1 + Math.floor(rng() * MAX_PLAYERS);
  const players: PlayerWireState[] = [];
  for (let i: number = 0; i < count; i++) {
    players.push({
      id: toNetId(i),
      x: randomRange(-660, 660, rng),
      y: randomRange(-660, 660, rng),
      vx: randomRange(-700, 700, rng),
      vy: randomRange(-700, 700, rng),
      a: randomRange(-Math.PI, Math.PI, rng),
      f: Math.floor(rng() * 4),
    });
  }

  const events: ServerEvent[] = [];
  const eventCount: number = Math.floor(rng() * 4);
  for (let i: number = 0; i < eventCount; i++) {
    const roll: number = rng();
    if (roll < 0.34) {
      events.push({
        k: "bump",
        t: tick - i,
        a: toNetId(0),
        b: toNetId(count - 1),
        px: randomRange(-660, 660, rng),
        py: randomRange(-660, 660, rng),
        s: randomRange(0, 1400, rng),
      });
    } else if (roll < 0.67) {
      events.push({ k: "fall", t: tick - i, id: toNetId(0) });
    } else {
      events.push({
        k: "respawn",
        t: tick - i,
        id: toNetId(0),
        x: randomRange(-330, 330, rng),
        y: randomRange(-330, 330, rng),
      });
    }
  }

  return {
    k: "snap",
    t: tick,
    ack: tick - SNAPSHOT_INTERVAL_TICKS,
    p: players,
    e: events,
  };
}

function roundedSnapshot(snap: ServerSnapshot): ServerSnapshot {
  return {
    k: "snap",
    t: snap.t,
    ack: snap.ack,
    p: snap.p.map((state: PlayerWireState) => ({
      id: state.id,
      x: roundLike(state.x, 100),
      y: roundLike(state.y, 100),
      vx: roundLike(state.vx, 100),
      vy: roundLike(state.vy, 100),
      a: roundLike(state.a, 1000),
      f: state.f,
    })),
    e: (snap.e ?? []).map((event: ServerEvent): ServerEvent => {
      if (event.k === "bump") {
        return {
          k: "bump",
          t: event.t,
          a: event.a,
          b: event.b,
          px: roundLike(event.px, 100),
          py: roundLike(event.py, 100),
          s: roundLike(event.s, 100),
        };
      }
      if (event.k === "respawn") {
        return {
          k: "respawn",
          t: event.t,
          id: event.id,
          x: roundLike(event.x, 100),
          y: roundLike(event.y, 100),
        };
      }
      return event;
    }),
  };
}

describe("randomly generated snapshots survive the round trip", () => {
  it("holds over 500 seeded snapshots", () => {
    const rng: () => number = mulberry32(0x5eed);
    let checked: number = 0;

    for (let i: number = 0; i < 500; i++) {
      const snap: ServerSnapshot = randomSnapshot(rng, 3 * i + 100);
      const wire: string = encodeServer(snap);
      const decoded: ServerMessage = decodedServer(wire);

      expect(decoded).toStrictEqual(roundedSnapshot(snap));
      expect(encodeServer(decoded)).toBe(wire);
      checked++;
    }

    expect(checked).toBe(500);
  });

  it("is reproducible: the same seed produces the same first frame", () => {
    const a: ServerSnapshot = randomSnapshot(mulberry32(0x5eed), 100);
    const b: ServerSnapshot = randomSnapshot(mulberry32(0x5eed), 100);

    expect(encodeServer(a)).toBe(encodeServer(b));
    expect(encodeServer(a)).not.toBe(
      encodeServer(randomSnapshot(mulberry32(0xbeef), 100)),
    );
  });
});
