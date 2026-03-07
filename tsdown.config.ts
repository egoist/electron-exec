import { defineConfig } from "tsdown"

export default defineConfig({
  entry: ["src/index.ts", "src/main.ts"],
  format: ["esm"],
  outDir: "dist",
  dts: true,
  external: ["electron"],
})
