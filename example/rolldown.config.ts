import { defineConfig } from "rolldown"

export default defineConfig([
  {
    input: "./example/main.ts",
    external: ["electron"],
    output: {
      file: "./example/dist/main.cjs",
      format: "cjs",
    },
  },
  {
    input: "./example/renderer.ts",
    output: {
      file: "./example/dist/renderer.js",
      format: "iife",
    },
  },
])
