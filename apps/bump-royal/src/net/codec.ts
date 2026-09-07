import {
  INPUT_REDUNDANCY,
  MAX_EVENTS_PER_SNAPSHOT,
  MAX_NAME_LENGTH,
  MAX_PLAYERS,
  PROTOCOL_VERSION,
  toNetId,
} from "./protocol";
import type {
  BumpEvent,
  ClientHello,
  ClientInput,
  ClientMessage,
  FallEvent,
  InputFrame,
  NetId,
  PlayerInfo,
  PlayerWireState,
  RespawnEvent,
  ServerEvent,
  ServerJoin,
  ServerLeave,
  ServerMessage,
  ServerSnapshot,
  ServerWelcome,
} from "./protocol";

const POSITION_PRECISION: number = 100;
const ANGLE_PRECISION: number = 1000;
const SPAWN_ARITY: number = 2;

function roundTo(value: number, precision: number): number {
  const rounded: number = Math.round(value * precision) / precision;
  /* JSON.stringify writes -0 as "0", so a decoded message could never equal an encoded one
     unless the sign of zero is normalised here. */
  return rounded === 0 ? 0 : rounded;
}

function round2(value: number): number {
  return roundTo(value, POSITION_PRECISION);
}

function round3(value: number): number {
  return roundTo(value, ANGLE_PRECISION);
}

function encodeInputFrame(frame: InputFrame): InputFrame {
  return { t: frame.t, x: frame.x, y: frame.y, d: frame.d };
}

function encodeClientMessage(msg: ClientMessage): ClientMessage {
  switch (msg.k) {
    case "hello":
      return msg.name === undefined
        ? { k: "hello", v: msg.v }
        : { k: "hello", v: msg.v, name: msg.name };
    case "input":
      return { k: "input", f: msg.f.map(encodeInputFrame), a: msg.a };
  }
}

function encodePlayerInfo(info: PlayerInfo): PlayerInfo {
  return {
    id: info.id,
    color: info.color,
    name: info.name,
    spawn: [round2(info.spawn[0]), round2(info.spawn[1])],
  };
}

function encodePlayerWireState(state: PlayerWireState): PlayerWireState {
  return {
    id: state.id,
    x: round2(state.x),
    y: round2(state.y),
    vx: round2(state.vx),
    vy: round2(state.vy),
    a: round3(state.a),
    f: state.f,
  };
}

function encodeServerEvent(event: ServerEvent): ServerEvent {
  switch (event.k) {
    case "bump":
      return {
        k: "bump",
        t: event.t,
        a: event.a,
        b: event.b,
        px: round2(event.px),
        py: round2(event.py),
        s: round2(event.s),
      };
    case "fall":
      return { k: "fall", t: event.t, id: event.id };
    case "respawn":
      return {
        k: "respawn",
        t: event.t,
        id: event.id,
        x: round2(event.x),
        y: round2(event.y),
      };
  }
}

function encodeServerMessage(msg: ServerMessage): ServerMessage {
  switch (msg.k) {
    case "welcome":
      return {
        k: "welcome",
        v: msg.v,
        you: msg.you,
        tick: msg.tick,
        hz: msg.hz,
        snapEvery: msg.snapEvery,
        players: msg.players.map(encodePlayerInfo),
      };
    case "join":
      return {
        k: "join",
        tick: msg.tick,
        player: encodePlayerInfo(msg.player),
      };
    case "leave":
      return { k: "leave", tick: msg.tick, id: msg.id };
    case "snap":
      return msg.e === undefined
        ? {
            k: "snap",
            t: msg.t,
            ack: msg.ack,
            p: msg.p.map(encodePlayerWireState),
          }
        : {
            k: "snap",
            t: msg.t,
            ack: msg.ack,
            p: msg.p.map(encodePlayerWireState),
            e: msg.e.map(encodeServerEvent),
          };
  }
}

export function encodeClient(msg: ClientMessage): string {
  return JSON.stringify(encodeClientMessage(msg));
}

export function encodeServer(msg: ServerMessage): string {
  return JSON.stringify(encodeServerMessage(msg));
}

function parseJson(raw: string): unknown {
  try {
    return JSON.parse(raw) as unknown;
  } catch {
    return undefined;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function isInt(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value);
}

function isIndex(value: unknown): value is number {
  return isInt(value) && value >= 0;
}

function isAxis(value: unknown): value is -1 | 0 | 1 {
  return value === -1 || value === 0 || value === 1;
}

function decodeNetId(value: unknown): NetId | null {
  return isIndex(value) ? toNetId(value) : null;
}

function decodeArray<T>(
  value: unknown,
  max: number,
  decodeItem: (item: unknown) => T | null,
): T[] | null {
  if (!Array.isArray(value)) return null;
  const items: readonly unknown[] = value;
  if (items.length > max) return null;

  const decoded: T[] = [];
  for (const item of items) {
    const one: T | null = decodeItem(item);
    if (one === null) return null;
    decoded.push(one);
  }
  return decoded;
}

function decodeInputFrame(value: unknown): InputFrame | null {
  if (!isRecord(value)) return null;

  const t: unknown = value.t;
  const x: unknown = value.x;
  const y: unknown = value.y;
  const d: unknown = value.d;
  if (!isInt(t) || !isAxis(x) || !isAxis(y) || typeof d !== "boolean") {
    return null;
  }
  return { t, x, y, d };
}

function decodeHello(source: Record<string, unknown>): ClientHello | null {
  if (source.v !== PROTOCOL_VERSION) return null;

  const name: unknown = source.name;
  if (name === undefined) return { k: "hello", v: PROTOCOL_VERSION };
  if (typeof name !== "string" || name.length > MAX_NAME_LENGTH) return null;
  return { k: "hello", v: PROTOCOL_VERSION, name };
}

function decodeInput(source: Record<string, unknown>): ClientInput | null {
  const a: unknown = source.a;
  if (!isInt(a)) return null;

  const f: InputFrame[] | null = decodeArray(
    source.f,
    INPUT_REDUNDANCY,
    decodeInputFrame,
  );
  if (f === null) return null;
  return { k: "input", f, a };
}

/* Never throws. Both decoders sit on a socket fed by a remote peer: every field is untrusted,
   so anything malformed degrades to null rather than taking the socket handler down. */
export function decodeClient(raw: string): ClientMessage | null {
  const parsed: unknown = parseJson(raw);
  if (!isRecord(parsed)) return null;

  const kind: unknown = parsed.k;
  if (kind === "hello") return decodeHello(parsed);
  if (kind === "input") return decodeInput(parsed);
  return null;
}

function decodeSpawn(value: unknown): [number, number] | null {
  if (!Array.isArray(value)) return null;
  const items: readonly unknown[] = value;
  if (items.length !== SPAWN_ARITY) return null;

  const x: unknown = items[0];
  const y: unknown = items[1];
  if (!isFiniteNumber(x) || !isFiniteNumber(y)) return null;
  return [x, y];
}

function decodePlayerInfo(value: unknown): PlayerInfo | null {
  if (!isRecord(value)) return null;

  const id: NetId | null = decodeNetId(value.id);
  if (id === null) return null;

  const color: unknown = value.color;
  const name: unknown = value.name;
  if (!isIndex(color)) return null;
  if (typeof name !== "string" || name.length > MAX_NAME_LENGTH) return null;

  const spawn: [number, number] | null = decodeSpawn(value.spawn);
  if (spawn === null) return null;
  return { id, color, name, spawn };
}

function decodePlayerWireState(value: unknown): PlayerWireState | null {
  if (!isRecord(value)) return null;

  const id: NetId | null = decodeNetId(value.id);
  if (id === null) return null;

  const x: unknown = value.x;
  const y: unknown = value.y;
  const vx: unknown = value.vx;
  const vy: unknown = value.vy;
  const a: unknown = value.a;
  const f: unknown = value.f;
  if (
    !isFiniteNumber(x) ||
    !isFiniteNumber(y) ||
    !isFiniteNumber(vx) ||
    !isFiniteNumber(vy) ||
    !isFiniteNumber(a) ||
    !isIndex(f)
  ) {
    return null;
  }
  return { id, x, y, vx, vy, a, f };
}

function decodeBumpEvent(source: Record<string, unknown>): BumpEvent | null {
  const t: unknown = source.t;
  if (!isInt(t)) return null;

  const a: NetId | null = decodeNetId(source.a);
  const b: NetId | null = decodeNetId(source.b);
  if (a === null || b === null) return null;

  const px: unknown = source.px;
  const py: unknown = source.py;
  const s: unknown = source.s;
  if (!isFiniteNumber(px) || !isFiniteNumber(py) || !isFiniteNumber(s)) {
    return null;
  }
  return { k: "bump", t, a, b, px, py, s };
}

function decodeFallEvent(source: Record<string, unknown>): FallEvent | null {
  const t: unknown = source.t;
  const id: NetId | null = decodeNetId(source.id);
  if (!isInt(t) || id === null) return null;
  return { k: "fall", t, id };
}

function decodeRespawnEvent(
  source: Record<string, unknown>,
): RespawnEvent | null {
  const t: unknown = source.t;
  const id: NetId | null = decodeNetId(source.id);
  if (!isInt(t) || id === null) return null;

  const x: unknown = source.x;
  const y: unknown = source.y;
  if (!isFiniteNumber(x) || !isFiniteNumber(y)) return null;
  return { k: "respawn", t, id, x, y };
}

function decodeServerEvent(value: unknown): ServerEvent | null {
  if (!isRecord(value)) return null;

  const kind: unknown = value.k;
  if (kind === "bump") return decodeBumpEvent(value);
  if (kind === "fall") return decodeFallEvent(value);
  if (kind === "respawn") return decodeRespawnEvent(value);
  return null;
}

function decodeWelcome(source: Record<string, unknown>): ServerWelcome | null {
  const v: unknown = source.v;
  const tick: unknown = source.tick;
  const hz: unknown = source.hz;
  const snapEvery: unknown = source.snapEvery;
  if (!isIndex(v) || !isInt(tick)) return null;
  if (!isIndex(hz) || hz === 0) return null;
  if (!isIndex(snapEvery) || snapEvery === 0) return null;

  const you: NetId | null = decodeNetId(source.you);
  if (you === null) return null;

  const players: PlayerInfo[] | null = decodeArray(
    source.players,
    MAX_PLAYERS,
    decodePlayerInfo,
  );
  if (players === null) return null;
  return { k: "welcome", v, you, tick, hz, snapEvery, players };
}

function decodeJoin(source: Record<string, unknown>): ServerJoin | null {
  const tick: unknown = source.tick;
  if (!isInt(tick)) return null;

  const player: PlayerInfo | null = decodePlayerInfo(source.player);
  if (player === null) return null;
  return { k: "join", tick, player };
}

function decodeLeave(source: Record<string, unknown>): ServerLeave | null {
  const tick: unknown = source.tick;
  const id: NetId | null = decodeNetId(source.id);
  if (!isInt(tick) || id === null) return null;
  return { k: "leave", tick, id };
}

function decodeSnapshot(
  source: Record<string, unknown>,
): ServerSnapshot | null {
  const t: unknown = source.t;
  const ack: unknown = source.ack;
  if (!isInt(t) || !isInt(ack)) return null;

  const p: PlayerWireState[] | null = decodeArray(
    source.p,
    MAX_PLAYERS,
    decodePlayerWireState,
  );
  if (p === null) return null;

  const e: unknown = source.e;
  if (e === undefined) return { k: "snap", t, ack, p };

  const events: ServerEvent[] | null = decodeArray(
    e,
    MAX_EVENTS_PER_SNAPSHOT,
    decodeServerEvent,
  );
  if (events === null) return null;
  return { k: "snap", t, ack, p, e: events };
}

export function decodeServer(raw: string): ServerMessage | null {
  const parsed: unknown = parseJson(raw);
  if (!isRecord(parsed)) return null;

  const kind: unknown = parsed.k;
  if (kind === "welcome") return decodeWelcome(parsed);
  if (kind === "join") return decodeJoin(parsed);
  if (kind === "leave") return decodeLeave(parsed);
  if (kind === "snap") return decodeSnapshot(parsed);
  return null;
}
