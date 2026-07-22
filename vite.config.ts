/// <reference types="vitest" />
import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const nodeMajor = Number(process.versions.node.split(".")[0] ?? "0");

export default defineConfig({
  plugins: [react()],
  resolve: { alias: { "@": path.resolve(__dirname, "./src") } },
  test: {
    environment: "jsdom",
    setupFiles: ["./src/test/setup.ts"],
    globals: true,
    exclude: ["**/node_modules/**", "**/dist/**", "**/e2e/**"],
    // Node 25+ enables experimental Web Storage on the global object with an
    // empty `--localstorage-file`, which breaks jsdom’s Storage mock and
    // spams warnings. Turn it off in Vitest workers (flag exists from Node 25).
    ...(nodeMajor >= 25 ? { execArgv: ["--no-experimental-webstorage"] } : {}),
  },
});
