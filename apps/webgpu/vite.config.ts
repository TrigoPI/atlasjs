import { defineConfig } from "vite";

// https://vite.dev/config/
export default defineConfig({
  define: {
    __DEV__: "true",
    __CONSOLE_TRANSPORT__: "true",
    __WEBSOCKET_TRANSPORT__: "false",
  },
});
