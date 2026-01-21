import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      "/chat": "http://localhost:3001",
      "/models": "http://localhost:3001"
    }
  },
  build: {
    outDir: path.resolve(__dirname, "../server/public"),
    emptyOutDir: true
  }
});
