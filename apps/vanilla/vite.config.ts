import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";

const appRoot = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(appRoot, "../..");

export default defineConfig({
  optimizeDeps: {
    exclude: [
      "@de-novo/canvas",
      "@de-novo/canvas/web",
      "@de-novo/canvas-core",
      "@de-novo/canvas-editor",
      "@de-novo/canvas-web"
    ]
  },
  server: {
    fs: {
      allow: [repoRoot]
    }
  }
});
