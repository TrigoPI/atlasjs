import { defineConfig } from "vitest/config";

// Build-time flags injected by Vite in the apps; stubbed here so the shared
// logger (@atlasjs/utils) runs under the test environment.
export default defineConfig({
  define: {
    __DEV__: "false",
    __CONSOLE_TRANSPORT__: "false",
    __WEBSOCKET_TRANSPORT__: "false",
  },
  test: {
    include: ["test/**/*.test.ts"],
  },
});
