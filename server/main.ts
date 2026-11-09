// Production entry point: serves the built app and the API on the loopback interface.
import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { createServer, type ServerResponse } from "node:http";
import { extname, join, normalize, resolve } from "node:path";
import { createApi } from "./api.ts";
import { CONTENT_SECURITY_POLICY } from "./csp.ts";
import { JobStore } from "./jobs.ts";

const PORT = Number(process.env.PORT) || 8787;
const HOST = process.env.HOST ?? "127.0.0.1";
const DIST = resolve(import.meta.dirname, "../dist");
const TYPES: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".woff2": "font/woff2",
  ".woff": "font/woff",
  ".json": "application/json",
  ".webmanifest": "application/manifest+json",
};

const store = new JobStore(resolve(process.env.CHIZU_DATA ?? "data"));
await store.load();
const api = createApi(store);

createServer((req, res) => {
  res.setHeader("content-security-policy", CONTENT_SECURITY_POLICY);
  res.setHeader("x-content-type-options", "nosniff");
  res.setHeader("referrer-policy", "no-referrer");
  api(req, res, () => void serveStatic(req.url ?? "/", res));
}).listen(PORT, HOST, () =>
  process.stdout.write(`chizu: http://${HOST === "127.0.0.1" ? "localhost" : HOST}:${PORT}\n`),
);

async function serveStatic(rawUrl: string, res: ServerResponse) {
  const pathname = decodeURIComponent(new URL(rawUrl, "http://localhost").pathname);
  const candidate = normalize(join(DIST, pathname));
  const inside = candidate.startsWith(DIST);
  const file =
    inside && (await stat(candidate).catch(() => undefined))?.isFile()
      ? candidate
      : join(DIST, "index.html");
  const hashed = file.includes(`${DIST}/assets/`);
  res.writeHead(200, {
    "content-type": TYPES[extname(file)] ?? "application/octet-stream",
    "cache-control": hashed ? "public, max-age=31536000, immutable" : "no-cache",
  });
  createReadStream(file)
    .on("error", () => res.end())
    .pipe(res);
}
