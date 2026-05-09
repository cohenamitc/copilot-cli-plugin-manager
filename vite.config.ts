import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";
import { readFileSync } from "fs";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const pkg = JSON.parse(readFileSync(path.join(__dirname, "package.json"), "utf-8"));

export default defineConfig({
  plugins: [react()],
  root: "src/client",
  publicDir: "../../public",
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
  },
  build: {
    outDir: "../../dist/client",
    emptyOutDir: true,
  },
  server: {
    port: 5173,
    proxy: {
      "/api": {
        target: "http://localhost:3200",
        changeOrigin: true,
      },
    },
  },
  resolve: {
    alias: {
      "@client": path.resolve(__dirname, "src/client"),
    },
  },
});
