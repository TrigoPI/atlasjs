import type { Engine, StepContext, StepSet } from "@atlasjs/core";
import { NEXUS } from "@atlasjs/nexus";
import type { NexusWorld } from "@atlasjs/nexus";

import type { NetId, ServerSnapshot } from "../net/protocol";

import { registerApplyNetIntents } from "./applyNetIntents";
import {
  createHeadlessEngine,
  SERVER_FIXED_DELTA,
  SERVER_MAX_SUB_STEPS,
} from "./createHeadlessEngine";
import { createTimerLoop } from "./createTimerLoop";
import { GameRoom } from "./GameRoom";
import { InputInbox } from "./InputInbox";
import { ServerScene } from "./ServerScene";
import { WebSocketTransport } from "./WebSocketTransport";
import { registerWriteSnapshot } from "./writeSnapshot";

export const DEFAULT_PORT: number = 8787;

const NET_STEP_SET: string = "server:net";
const CLOCK_STEP: string = "bump-royal:server-clock";
const MS_PER_SECOND: number = 1000;

export type GameServerOptions = {
  port?: number;
  host?: string;
  fixedDelta?: number;
  maxSubSteps?: number;
};

export type GameServer = {
  engine: Engine;
  world: NexusWorld;
  room: GameRoom;
  inbox: InputInbox;
  transport: WebSocketTransport;
  port: number;
  currentTick: () => number;
  close: () => Promise<void>;
};

export async function createGameServer(
  options: GameServerOptions = {},
): Promise<GameServer> {
  const fixedDelta: number = options.fixedDelta ?? SERVER_FIXED_DELTA;
  const maxSubSteps: number = options.maxSubSteps ?? SERVER_MAX_SUB_STEPS;

  const engine: Engine = await createHeadlessEngine({
    fixedDelta,
    maxSubSteps,
    loop: createTimerLoop({
      periodMs: fixedDelta * MS_PER_SECOND,
      maxDeltaMs: maxSubSteps * fixedDelta * MS_PER_SECOND,
    }),
  });

  await engine.scene.set(new ServerScene());

  const world: NexusWorld = engine.services.get(NEXUS);
  const room: GameRoom = new GameRoom(engine.services);
  const inbox: InputInbox = new InputInbox();

  /* join, leave and welcome are timestamped with the tick the client should attach them to,
     and the fixed lane is the only place that number exists. */
  let tick: number = 0;
  const currentTick = (): number => tick;

  const transport: WebSocketTransport = new WebSocketTransport({
    port: options.port ?? DEFAULT_PORT,
    host: options.host,
    room,
    inbox,
    currentTick,
  });

  const steps: StepSet = engine.scheduler.createSet(NET_STEP_SET);

  steps.add(
    "fixed",
    (ctx: StepContext): void => {
      tick = ctx.tick;
    },
    { name: CLOCK_STEP, stage: "PreSim" },
  );

  registerApplyNetIntents(steps, world, inbox);

  registerWriteSnapshot(steps, world, {
    recipients: (): readonly NetId[] => transport.recipients(),
    ackFor: (id: NetId): number => inbox.ackOf(id),
    send: (id: NetId, snapshot: ServerSnapshot): void =>
      transport.send(id, snapshot),
  });

  const port: number = await transport.start();

  return {
    engine,
    world,
    room,
    inbox,
    transport,
    port,
    currentTick,
    /* Transport first: a socket callback that fired after engine.stop() would reach a world
       whose plugins are already uninstalled. */
    close: async (): Promise<void> => {
      await transport.close();
      room.clear();
      inbox.clear();
      engine.stop();
    },
  };
}
