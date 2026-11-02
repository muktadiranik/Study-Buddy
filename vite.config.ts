import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  // Keep the large example library separately cacheable from the application code.
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.endsWith("/src/data/study-sets.json")) return "study-examples";
        },
      },
    },
  },
  server: {
    port: 5173,
    strictPort: true,
    proxy: { "/api": "http://127.0.0.1:8000" },
  },
  preview: { proxy: { "/api": "http://127.0.0.1:8000" } },
});
