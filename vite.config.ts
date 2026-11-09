import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import react from "@vitejs/plugin-react";
import { defineConfig, type Plugin } from "vite";
import { META_CONTENT_SECURITY_POLICY } from "./server/csp.ts";

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

/** Static hosting (GitHub Pages) sends no headers, so the build carries the CSP itself. */
function contentSecurityPolicy(): Plugin {
  return {
    name: "chizu-csp",
    apply: "build",
    transformIndexHtml: () => [
      {
        tag: "meta",
        attrs: { "http-equiv": "Content-Security-Policy", content: META_CONTENT_SECURITY_POLICY },
        injectTo: "head-prepend",
      },
    ],
  };
}

export default defineConfig({
  // GitHub Pages serves the app under /<repository>/.
  base: process.env.CHIZU_BASE ?? "/",
  plugins: [react(), chizuApi(), contentSecurityPolicy()],
  server: {
    host: "127.0.0.1",
    port: 5173,
    // Windows drives mounted in WSL (/mnt/c) emit no file-change events.
    watch: {
      usePolling: process.platform === "linux" && process.cwd().startsWith("/mnt/"),
      // Jobs, photos and the Python environment are data, not source; polling
      // their thousands of files stalls the server on /mnt drives.
      ignored: ["**/data/**", "**/dist/**", "**/.vitest/**"],
    },
  },
});
