import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@css": "/css",
      "@assets": "/assets",
      "@maps": "/maps",
    },
  },
  define: {
    __DEV__: "false",
    __CONSOLE_TRANSPORT__: "true",
    __WEBSOCKET_TRANSPORT__: "false",
  },
});
