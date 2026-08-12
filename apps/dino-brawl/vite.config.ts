import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    allowedHosts: true,
  },
  resolve: {
    alias: {
      "@css": "/css",
      "@assets": "/assets",
      "@maps": "/maps",
    },
  },
  define: {
    __DEV__: "true",
    __CONSOLE_TRANSPORT__: "true",
    __WEBSOCKET_TRANSPORT__: "false",
  },
});
