import { defineConfig } from "tsdown";

export default defineConfig({
  entry: ["src/index.ts", "src/testing/index.ts"],
  format: ["esm"],
  dts: true,
  clean: true,
  sourcemap: true,
  unbundle: true,
});
