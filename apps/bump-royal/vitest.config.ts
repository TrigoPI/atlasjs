import { defineConfig } from "vitest/config";

export default defineConfig({
  define: {
    __DEV__: "false",
    __CONSOLE_TRANSPORT__: "true",
    __WEBSOCKET_TRANSPORT__: "false",
  },
  test: {
    include: ["test/**/*.test.ts"],
    /* The server e2e spec measures a wall-clock broadcast rate off a real 60 Hz engine loop.
       Workers competing for the same cores make that number meaningless. */
    fileParallelism: false,
  },
});
