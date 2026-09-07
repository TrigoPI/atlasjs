/* @atlasjs/utils reads __DEV__, __CONSOLE_TRANSPORT__ and __WEBSOCKET_TRANSPORT__ as bare
   globals. Vite supplies them through `define`, vitest through vitest.config.ts, plain Node
   through nothing at all — so `createLogger` throws a ReferenceError and takes `new Engine()`
   down with it. This module must be fully evaluated before the first @atlasjs import.
   `??=` so an outer harness can pin its own values before loading this. */

declare global {
  var __DEV__: boolean;
  var __CONSOLE_TRANSPORT__: boolean;
  var __WEBSOCKET_TRANSPORT__: boolean;
}

globalThis.__DEV__ ??= true;
globalThis.__CONSOLE_TRANSPORT__ ??= true;
globalThis.__WEBSOCKET_TRANSPORT__ ??= false;
