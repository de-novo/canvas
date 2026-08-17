import { svelte } from "@sveltejs/vite-plugin-svelte";
import { defineConfig } from "vite";

// NOTE: this app pins Vite 7 (not the repo-wide Vite 8 / rolldown-vite) because
// vite-plugin-svelte does not yet compile components correctly under the
// rolldown transform (it forces runes mode and breaks `new Component()`).
export default defineConfig({
  plugins: [svelte()],
  server: {
    host: "127.0.0.1",
    port: 5176
  }
});
