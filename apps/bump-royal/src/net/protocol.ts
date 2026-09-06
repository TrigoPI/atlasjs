export const PROTOCOL_VERSION: number = 1;
export const TICK_HZ: number = 60;
export const SNAPSHOT_INTERVAL_TICKS: number = 3;
export const INPUT_REDUNDANCY: number = 3;
export const MAX_PLAYERS: number = 8;
export const MAX_NAME_LENGTH: number = 24;

/* A snapshot spans SNAPSHOT_INTERVAL_TICKS ticks, and one tick can carry at most one bump per
   pair plus a fall and a respawn per player: 3 * (28 + 16) = 132 at MAX_PLAYERS. 256 is above
   anything the simulation can produce and still bounds a hostile payload. */
export const MAX_EVENTS_PER_SNAPSHOT: number = 256;

export type NetId = number & { readonly __kind: "NetId" };

export function toNetId(value: number): NetId {
  return value as NetId;
}

export type InputFrame = {
  readonly t: number;
  readonly x: -1 | 0 | 1;
  readonly y: -1 | 0 | 1;
  readonly d: boolean;
};

export type ClientHello = {
  readonly k: "hello";
  readonly v: number;
  readonly name?: string;
};

export type ClientInput = {
  readonly k: "input";
  readonly f: readonly InputFrame[];
  readonly a: number;
};

export type ClientMessage = ClientHello | ClientInput;

export type PlayerInfo = {
  readonly id: NetId;
  readonly color: number;
  readonly name: string;
  readonly spawn: readonly [number, number];
};

export const PlayerFlags = {
  None: 0,
  Falling: 1 << 0,
  Dashing: 1 << 1,
} as const;

export type PlayerFlag = (typeof PlayerFlags)[keyof typeof PlayerFlags];

export type PlayerWireState = {
  readonly id: NetId;
  readonly x: number;
  readonly y: number;
  readonly vx: number;
  readonly vy: number;
  readonly a: number;
  readonly f: number;
};

export type BumpEvent = {
  readonly k: "bump";
  readonly t: number;
  readonly a: NetId;
  readonly b: NetId;
  readonly px: number;
  readonly py: number;
  readonly s: number;
};

export type FallEvent = {
  readonly k: "fall";
  readonly t: number;
  readonly id: NetId;
};

export type RespawnEvent = {
  readonly k: "respawn";
  readonly t: number;
  readonly id: NetId;
  readonly x: number;
  readonly y: number;
};

export type ServerEvent = BumpEvent | FallEvent | RespawnEvent;

export type ServerWelcome = {
  readonly k: "welcome";
  readonly v: number;
  readonly you: NetId;
  readonly tick: number;
  readonly hz: number;
  readonly snapEvery: number;
  readonly players: readonly PlayerInfo[];
};

export type ServerJoin = {
  readonly k: "join";
  readonly tick: number;
  readonly player: PlayerInfo;
};

export type ServerLeave = {
  readonly k: "leave";
  readonly tick: number;
  readonly id: NetId;
};

export type ServerSnapshot = {
  readonly k: "snap";
  readonly t: number;
  readonly ack: number;
  readonly p: readonly PlayerWireState[];
  readonly e?: readonly ServerEvent[];
};

export type ServerMessage =
  | ServerWelcome
  | ServerJoin
  | ServerLeave
  | ServerSnapshot;
