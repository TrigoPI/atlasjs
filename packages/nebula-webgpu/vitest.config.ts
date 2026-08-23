import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { defineConfig, type Plugin } from "vitest/config";

const wgslReflectEntry: string = createRequire(import.meta.url)
  .resolve("wgsl_reflect")
  .replace("wgsl_reflect.node.js", "wgsl_reflect.module.js");

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
  resolve: {
    alias: {
      wgsl_reflect: wgslReflectEntry,
    },
  },
  define: {
    __DEV__: "false",
    __CONSOLE_TRANSPORT__: "false",
    __WEBSOCKET_TRANSPORT__: "false",
  },
  test: {
    include: ["test/**/*.test.ts"],
  },
});
