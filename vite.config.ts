import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  base: "/moon/",
  build: {
    outDir: "dist/moon",
  },
  plugins: [react()],
  server: {
    port: 5173,
  },
});
