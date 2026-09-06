declare global {
  var __DEV__: boolean;
  var __CONSOLE_TRANSPORT__: boolean;
}

export type LogCapture = {
  readonly errors: string[];
  restore: () => void;
};

/* vitest.config.ts's `define` block installs __DEV__ as a real global set to false — it is
   not substituted into @atlasjs/utils' dist — so createLogger returns a Logger with zero
   transports and every logger.error() is a no-op. A console.error spy taken as-is would
   therefore be vacuous. Forcing the flags the way src/server/env.ts does puts the loggers
   in the configuration the real server runs under, which is the only one worth asserting
   on. Must be called before the loggers are constructed, i.e. before the engine boots. */
export function captureErrorLogs(): LogCapture {
  const previousDev: boolean = globalThis.__DEV__;
  const previousConsole: boolean = globalThis.__CONSOLE_TRANSPORT__;
  const previousError: typeof console.error = console.error;

  globalThis.__DEV__ = true;
  globalThis.__CONSOLE_TRANSPORT__ = true;

  const errors: string[] = [];

  console.error = (...args: unknown[]): void => {
    errors.push(args.map((arg: unknown): string => String(arg)).join(" "));
  };

  return {
    errors,
    restore: (): void => {
      console.error = previousError;
      globalThis.__DEV__ = previousDev;
      globalThis.__CONSOLE_TRANSPORT__ = previousConsole;
    },
  };
}
