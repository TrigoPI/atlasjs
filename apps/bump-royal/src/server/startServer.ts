import type { Engine, StepContext, StepSet } from "@atlasjs/core";
import { Transform2D } from "@atlasjs/gameplay";
import { NEXUS } from "@atlasjs/nexus";
import type { Entity, NexusWorld } from "@atlasjs/nexus";
import { createLogger, Logger } from "@atlasjs/utils";

import { PlayerStatus } from "../game/sim/PlayerStatus";

import {
  createHeadlessEngine,
  SERVER_FIXED_DELTA,
  SERVER_MAX_SUB_STEPS,
} from "./createHeadlessEngine";

import { createTimerLoop } from "./createTimerLoop";
import { ServerScene } from "./ServerScene";

const SHUTDOWN_SIGNALS: NodeJS.Signals[] = ["SIGINT", "SIGTERM"];
const RUNNER_STEP: string = "server:runner";
const REPORT_INTERVAL_TICKS: number = 60;
const MS_PER_SECOND: number = 1000;
const TICKS_FLAG: string = "--ticks=";
const TICKS_ENV: string = "BUMP_ROYAL_TICKS";

export type ServerOptions = {
  ticks?: number;
};

export function parseTickLimit(
  argv: readonly string[],
  env: NodeJS.ProcessEnv,
): number | null {
  const flag: string | undefined = argv.find((arg: string): boolean =>
    arg.startsWith(TICKS_FLAG),
  );

  const raw: string | undefined =
    flag !== undefined ? flag.slice(TICKS_FLAG.length) : env[TICKS_ENV];

  if (raw === undefined || raw === "") {
    return null;
  }

  const value: number = Number.parseInt(raw, 10);

  if (!Number.isInteger(value) || value <= 0) {
    throw new Error(
      `Invalid tick limit "${raw}": expected a positive integer.`,
    );
  }

  return value;
}

function describePlayers(
  world: NexusWorld,
  players: readonly Entity[],
): string {
  return players
    .map((player: Entity, index: number): string => {
      const transform: Transform2D = world.requireComponent(
        player,
        Transform2D,
      );

      const status: PlayerStatus = world.requireComponent(player, PlayerStatus);

      const position: string = `${transform.position.x.toFixed(1)}, ${transform.position.y.toFixed(1)}`;

      return `p${index}=(${position}) falls=${status.fallCount}`;
    })
    .join(" ");
}

export async function startServer(options: ServerOptions = {}): Promise<void> {
  const logger: Logger = createLogger("BumpRoyalServer");

  const tickLimit: number | null =
    options.ticks ?? parseTickLimit(process.argv, process.env);

  const engine: Engine = await createHeadlessEngine({
    loop: createTimerLoop({
      periodMs: SERVER_FIXED_DELTA * MS_PER_SECOND,
      maxDeltaMs: SERVER_MAX_SUB_STEPS * SERVER_FIXED_DELTA * MS_PER_SECOND,
    }),
  });

  const scene: ServerScene = new ServerScene();
  await engine.scene.set(scene);

  const world: NexusWorld = engine.services.get(NEXUS);
  const runner: StepSet = engine.scheduler.createSet(RUNNER_STEP);
  const startedAt: number = performance.now();

  let stopped: boolean = false;
  let resolveRun: (() => void) | null = null;

  const run: Promise<void> = new Promise<void>((resolve: () => void): void => {
    resolveRun = resolve;
  });

  const finish = (tick: number): void => {
    const elapsed: number = performance.now() - startedAt;
    const hz: number = (tick * MS_PER_SECOND) / elapsed;

    logger.log(
      `completed ${tick} ticks in ${elapsed.toFixed(0)}ms (${hz.toFixed(2)} Hz)`,
    );

    engine.stop();
    resolveRun?.();
  };

  logger.log(
    `running ${tickLimit === null ? "until interrupted" : `${tickLimit} ticks`} at ${(1 / SERVER_FIXED_DELTA).toFixed(0)} Hz`,
  );

  runner.add(
    "fixed",
    (ctx: StepContext): void => {
      if (stopped) {
        return;
      }

      if (ctx.tick % REPORT_INTERVAL_TICKS === 0) {
        logger.log(
          `tick=${ctx.tick} ${describePlayers(world, scene.getPlayers())}`,
        );
      }

      if (tickLimit !== null && ctx.tick >= tickLimit) {
        stopped = true;

        /* Deferred out of the fixed lane on purpose: engine.stop() uninstalls the plugins
           and disposes the ScriptManager, and advanceFixed may still owe sub-steps from
           this frame's accumulator. The microtask lands after the whole frame, and long
           before the next timer. */
        queueMicrotask((): void => finish(ctx.tick));
      }
    },
    {
      name: RUNNER_STEP,
      stage: "Sync",
    },
  );

  const shutdown = (signal: NodeJS.Signals): void => {
    logger.log(`${signal} received, stopping engine`);
    engine.stop();
    process.exit(0);
  };

  for (const signal of SHUTDOWN_SIGNALS) {
    process.on(signal, (): void => shutdown(signal));
  }

  await run;
}
