import { readFileSync } from "node:fs";
import { defineConfig, type Plugin } from "vitest/config";

function wgslTextPlugin(): Plugin {
  return {
    name: "wgsl-text",
    transform(_code: string, id: string): { code: string } | null {
      if (!id.endsWith(".wgsl")) {
        return null;
      }

      const source: string = readFileSync(id, "utf-8");
      return { code: `export default ${JSON.stringify(source)};` };
    },
  };
}

export default defineConfig({
  plugins: [wgslTextPlugin()],
  define: {
    __DEV__: "false",
    __CONSOLE_TRANSPORT__: "false",
    __WEBSOCKET_TRANSPORT__: "false",
  },
  test: {
    include: ["test/**/*.test.ts"],
  },
});
