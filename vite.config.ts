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
    setupFiles: ["./tests/setup.ts"],
    globals: true,
    include: ["tests/**/*.{test,spec}.{ts,tsx}"],
    exclude: ["**/node_modules/**", "**/dist/**", "tests/e2e/**"],
    // Node 25+ enables experimental Web Storage on the global object with an
    // empty `--localstorage-file`, which breaks jsdom’s Storage mock and
    // spams warnings. Turn it off in Vitest workers (flag exists from Node 25).
    ...(nodeMajor >= 25 ? { execArgv: ["--no-experimental-webstorage"] } : {}),
  },
});
