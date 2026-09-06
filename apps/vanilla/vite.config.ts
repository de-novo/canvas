import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";

const appRoot = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(appRoot, "../..");

export default defineConfig({
  optimizeDeps: {
    exclude: [
      "@denovo/canvas",
      "@denovo/canvas/web",
      "@denovo/canvas-core",
      "@denovo/canvas-editor",
      "@denovo/canvas-web"
    ]
  },
  server: {
    fs: {
      allow: [repoRoot]
    }
  }
});
