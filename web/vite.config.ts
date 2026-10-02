import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

const API = "http://127.0.0.1:4900";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5274,
    proxy: {
      "/api": { target: API, changeOrigin: true },
      "/app": { target: API, changeOrigin: true },
    },
  },
  build: { outDir: "dist", emptyOutDir: true },
});
