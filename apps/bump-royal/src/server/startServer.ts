import type { StepContext, StepSet } from "@atlasjs/core";
import { createLogger, Logger } from "@atlasjs/utils";

import { SERVER_FIXED_DELTA } from "./createHeadlessEngine";
import { createGameServer, DEFAULT_PORT } from "./createGameServer";
import type { GameServer } from "./createGameServer";

const SHUTDOWN_SIGNALS: NodeJS.Signals[] = ["SIGINT", "SIGTERM"];
const RUNNER_STEP: string = "server:runner";
const REPORT_INTERVAL_TICKS: number = 300;
const MS_PER_SECOND: number = 1000;

const TICKS_FLAG: string = "--ticks=";
const TICKS_ENV: string = "BUMP_ROYAL_TICKS";
const PORT_FLAG: string = "--port=";
const PORT_ENV: string = "BUMP_ROYAL_PORT";
const HOST_FLAG: string = "--host=";
const HOST_ENV: string = "BUMP_ROYAL_HOST";

const MAX_PORT: number = 65535;

export type ServerOptions = {
  ticks?: number;
  port?: number;
  host?: string;
};

function readOption(
  argv: readonly string[],
  env: NodeJS.ProcessEnv,
  flag: string,
  envKey: string,
): string | null {
  const match: string | undefined = argv.find((arg: string): boolean =>
    arg.startsWith(flag),
  );

  const raw: string | undefined =
    match !== undefined ? match.slice(flag.length) : env[envKey];

  return raw === undefined || raw === "" ? null : raw;
}

function parseInteger(raw: string, label: string, max: number): number {
  const value: number = Number.parseInt(raw, 10);

  if (!Number.isInteger(value) || value < 0 || value > max) {
    throw new Error(`Invalid ${label} "${raw}".`);
  }

  return value;
}

export function parseTickLimit(
  argv: readonly string[],
  env: NodeJS.ProcessEnv,
): number | null {
  const raw: string | null = readOption(argv, env, TICKS_FLAG, TICKS_ENV);

  if (raw === null) {
    return null;
  }

  const value: number = parseInteger(
    raw,
    "tick limit",
    Number.MAX_SAFE_INTEGER,
  );

  if (value === 0) {
    throw new Error(
      `Invalid tick limit "${raw}": expected a positive integer.`,
    );
  }

  return value;
}

export function parsePort(
  argv: readonly string[],
  env: NodeJS.ProcessEnv,
): number {
  const raw: string | null = readOption(argv, env, PORT_FLAG, PORT_ENV);

  return raw === null ? DEFAULT_PORT : parseInteger(raw, "port", MAX_PORT);
}

export function parseHost(
  argv: readonly string[],
  env: NodeJS.ProcessEnv,
): string | undefined {
  return readOption(argv, env, HOST_FLAG, HOST_ENV) ?? undefined;
}

export async function startServer(options: ServerOptions = {}): Promise<void> {
  const logger: Logger = createLogger("BumpRoyalServer");

  const tickLimit: number | null =
    options.ticks ?? parseTickLimit(process.argv, process.env);

  const server: GameServer = await createGameServer({
    port: options.port ?? parsePort(process.argv, process.env),
    host: options.host ?? parseHost(process.argv, process.env),
  });

  const runner: StepSet = server.engine.scheduler.createSet(RUNNER_STEP);
  const startedAt: number = performance.now();

  let stopped: boolean = false;
  let resolveRun: (() => void) | null = null;

  const run: Promise<void> = new Promise<void>((resolve: () => void): void => {
    resolveRun = resolve;
  });

  const finish = async (tick: number): Promise<void> => {
    const elapsed: number = performance.now() - startedAt;
    const hz: number = (tick * MS_PER_SECOND) / elapsed;

    logger.log(
      `completed ${tick} ticks in ${elapsed.toFixed(0)}ms (${hz.toFixed(2)} Hz)`,
    );

    await server.close();
    resolveRun?.();
  };

  logger.log(
    `listening on ws://${options.host ?? "localhost"}:${server.port} at ${(1 / SERVER_FIXED_DELTA).toFixed(0)} Hz`,
  );

  logger.log(
    `running ${tickLimit === null ? "until interrupted" : `${tickLimit} ticks`}`,
  );

  runner.add(
    "fixed",
    (ctx: StepContext): void => {
      if (stopped) {
        return;
      }

      if (ctx.tick % REPORT_INTERVAL_TICKS === 0) {
        logger.log(`tick=${ctx.tick} players=${server.room.size}`);
      }

      if (tickLimit !== null && ctx.tick >= tickLimit) {
        stopped = true;

        /* Deferred out of the fixed lane on purpose: engine.stop() uninstalls the plugins
           and disposes the ScriptManager, and advanceFixed may still owe sub-steps from
           this frame's accumulator. The microtask lands after the whole frame, and long
           before the next timer. */
        queueMicrotask((): void => void finish(ctx.tick));
      }
    },
    {
      name: RUNNER_STEP,
      stage: "Sync",
    },
  );

  const shutdown = (signal: NodeJS.Signals): void => {
    logger.log(`${signal} received, stopping server`);

    void server.close().then((): void => {
      process.exit(0);
    });
  };

  for (const signal of SHUTDOWN_SIGNALS) {
    process.on(signal, (): void => shutdown(signal));
  }

  await run;
}
