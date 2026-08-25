import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react()],
  optimizeDeps: {
    include: ["three", "three128", "three165"]
  },
  server: {
    host: "127.0.0.1",
    port: 5179
  }
});
