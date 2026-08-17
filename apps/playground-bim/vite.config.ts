import { defineConfig } from "vite";

export default defineConfig({
  // web-ifc ships a WASM binary loaded at runtime + an ESM entry that Vite must
  // not pre-bundle (doing so drops the WASM URL resolution). Exclude it so the
  // adapter resolves the module and the `public/wasm/` assets as-is.
  optimizeDeps: {
    exclude: ["web-ifc"]
  },
  server: {
    host: "127.0.0.1",
    port: 5178
  }
});
