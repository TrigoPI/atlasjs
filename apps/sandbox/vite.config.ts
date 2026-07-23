import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@css": "/css",
      "@sandbox": "/src",
      "@assets": "/assets",
    },
  },
  define: {
    __DEV__: "true",
    __CONSOLE_TRANSPORT__: "true",
    __WEBSOCKET_TRANSPORT__: "false",
  },
});
