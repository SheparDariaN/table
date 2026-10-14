import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      "/api": {
        changeOrigin: false,
        rewrite: (path) => path.replace(/^\/api/, ""),
        target: "http://localhost:3000",
      },
    },
  },
});
