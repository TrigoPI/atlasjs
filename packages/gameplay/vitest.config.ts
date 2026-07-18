import babel from "@rolldown/plugin-babel";
import { defineConfig } from "vitest/config";

export default defineConfig({
  define: {
    __DEV__: "false",
    __CONSOLE_TRANSPORT__: "false",
    __WEBSOCKET_TRANSPORT__: "false",
  },
  plugins: [
    babel({
      plugins: [
        [
          "@babel/plugin-proposal-decorators",
          {
            version: "2023-11",
          },
        ],
      ],
    }),
  ],
  test: {
    include: ["test/**/*.test.ts"],
  },
});
