import { Engine } from "@atlasjs/core";
import { createLogger, Logger } from "@atlasjs/utils";

const SHUTDOWN_SIGNALS: NodeJS.Signals[] = ["SIGINT", "SIGTERM"];

export async function startServer(): Promise<void> {
  const logger: Logger = createLogger("BumpRoyalServer");
  const engine: Engine = new Engine();

  logger.log(`engine constructed (booted=${String(engine.isBooted())})`);

  const shutdown = (signal: NodeJS.Signals): void => {
    logger.log(`${signal} received, stopping engine`);
    engine.stop();
    process.exit(0);
  };

  for (const signal of SHUTDOWN_SIGNALS) {
    process.on(signal, (): void => shutdown(signal));
  }
}
