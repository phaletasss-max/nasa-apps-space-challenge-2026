import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// base "./" so the static build works from any sub-path (GitHub Pages, Vercel, a USB stick).
export default defineConfig({
  base: "./",
  plugins: [react()],
  worker: { format: "es" },
  optimizeDeps: { exclude: ["maplibre-gl"] },
  build: { chunkSizeWarningLimit: 2500 },
});
