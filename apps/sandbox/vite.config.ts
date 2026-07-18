import babel from "@rolldown/plugin-babel";
import { type PluginOption, defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [
    react(),
    babel({
      plugins: [["@babel/plugin-proposal-decorators", { version: "2023-11" }]],
    }) as unknown as PluginOption,
  ],
  resolve: {
    alias: {
      "@css": "/css",
      "@sandbox": "/src",
    },
  },
  define: {
    __DEV__: "true",
    __CONSOLE_TRANSPORT__: "true",
    __WEBSOCKET_TRANSPORT__: "false",
  },
});
