import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import react from "@vitejs/plugin-react";
import { defineConfig, type Plugin } from "vite";

/**
 * Mounts the API inside the dev server, so `npm run dev` is a single process.
 * The server is imported at runtime by Node, not bundled into this config, so it
 * runs exactly as in production.
 */
function chizuApi(): Plugin {
  return {
    name: "chizu-api",
    apply: "serve",
    async configureServer(server) {
      const entry = pathToFileURL(resolve("server/dev.ts")).href;
      const { createDevApi } = (await import(entry)) as typeof import("./server/dev.ts");
      server.middlewares.use(await createDevApi());
    },
  };
}

export default defineConfig({
  plugins: [react(), chizuApi()],
  server: {
    host: "127.0.0.1",
    port: 5173,
    // Windows drives mounted in WSL (/mnt/c) emit no file-change events.
    watch: { usePolling: process.platform === "linux" && process.cwd().startsWith("/mnt/") },
  },
});
