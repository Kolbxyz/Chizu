// HTTP API, mounted by the Vite dev server and by the production server.
import { createReadStream } from "node:fs";
import type { IncomingMessage, ServerResponse } from "node:http";
import { Readable } from "node:stream";
import { claudeCodeAvailable } from "./claude.ts";
import { ImageRejected } from "./images.ts";
import { browserAvailable } from "./browser/available.ts";
import type { JobOptions, JobStore, UploadedImage } from "./jobs.ts";
import { sandboxAvailable } from "./sandbox.ts";

const MAX_IMAGES = 12;
const MAX_IMAGE_BYTES = 40 * 1024 * 1024;
const MAX_UPLOAD_BYTES = 200 * 1024 * 1024;
const MAX_HINT_CHARS = 2000;
const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]"]);
const LOCALE_PATTERN = /^[a-zA-Z]{2,3}(-[a-zA-Z0-9]{2,8})*$/;

class HttpError extends Error {
  readonly status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

/** Returns a request handler; it answers `/api/*` and passes anything else to `next`. */
export function createApi(store: JobStore) {
  // These checks take seconds (a CLI call, loading playwright); start them now
  // so /api/health answers from their cached results.
  void Promise.all([claudeCodeAvailable(), sandboxAvailable(), browserAvailable()]);
  return (req: IncomingMessage, res: ServerResponse, next: () => void) => {
    const url = new URL(req.url ?? "/", "http://localhost");
    if (!url.pathname.startsWith("/api/")) return next();
    route(store, req, res, url).catch((err: unknown) => {
      const status =
        err instanceof HttpError ? err.status : err instanceof ImageRejected ? 422 : 500;
      if (status === 500) process.stderr.write(`chizu: request failed: ${String(err)}\n`);
      if (res.headersSent) res.end();
      else json(res, status, { error: err instanceof Error ? err.message : "internal error" });
    });
  };
}

async function route(store: JobStore, req: IncomingMessage, res: ServerResponse, url: URL) {
  guard(req);
  const parts = url.pathname.split("/").filter(Boolean).slice(1); // drop "api"
  const [resource, id, action, arg] = parts;
  if (resource === "health" && req.method === "GET") {
    const [claudeCode, code, browser] = await Promise.all([
      claudeCodeAvailable(),
      sandboxAvailable(),
      browserAvailable(),
    ]);
    return json(res, 200, { claudeCode, code, browser });
  }
  if (resource !== "jobs") throw new HttpError(404, "not found");
  const method = req.method ?? "GET";

  if (!id) {
    if (method === "GET") return json(res, 200, store.list());
    if (method === "POST") {
      const { uploads, locale, options } = await readUpload(req);
      return json(res, 201, await store.create(uploads, locale, options));
    }
    throw new HttpError(405, "method not allowed");
  }

  const job = store.get(id);
  if (!job) throw new HttpError(404, "job not found");

  if (!action) {
    if (method === "GET") return json(res, 200, job);
    if (method === "DELETE") return json(res, 200, { deleted: await store.remove(id) });
  } else if (action === "events" && method === "GET") {
    return streamEvents(store, id, req, res);
  } else if (action === "images" && method === "GET") {
    const path = store.imagePath(id, Number(arg));
    if (!path) throw new HttpError(404, "image not found");
    res.writeHead(200, {
      "content-type": "image/jpeg",
      "cache-control": "private, max-age=31536000, immutable",
    });
    return void createReadStream(path).pipe(res);
  } else if (action === "hint" && method === "POST") {
    const body = (await readJson(req)) as { text?: unknown };
    const text = typeof body.text === "string" ? body.text.trim() : "";
    if (!text || text.length > MAX_HINT_CHARS) throw new HttpError(400, "invalid hint");
    return json(res, 202, { accepted: store.hint(id, text) });
  } else if (action === "cancel" && method === "POST") {
    return json(res, 202, { accepted: store.cancel(id) });
  }
  throw new HttpError(405, "method not allowed");
}

/**
 * The API spends the user's Claude usage, so it only serves the local app:
 * the Host check defeats DNS rebinding, and the custom header on writes forces
 * a CORS preflight that cross-site pages cannot pass.
 */
function guard(req: IncomingMessage) {
  const host = (req.headers.host ?? "").replace(/:\d+$/, "");
  if (!LOCAL_HOSTS.has(host)) throw new HttpError(403, "forbidden host");
  const isRead = req.method === "GET" || req.method === "HEAD";
  if (!isRead && req.headers["x-chizu"] !== "1") throw new HttpError(403, "missing x-chizu header");
}

function streamEvents(store: JobStore, id: string, req: IncomingMessage, res: ServerResponse) {
  res.writeHead(200, {
    "content-type": "text/event-stream",
    "cache-control": "no-cache",
    connection: "keep-alive",
  });
  const send = (type: string, data: unknown) =>
    res.write(`event: ${type}\ndata: ${JSON.stringify(data)}\n\n`);
  send("snapshot", store.get(id));
  const unsubscribe = store.subscribe(id, (event) => send("event", event));
  const keepAlive = setInterval(() => res.write(": keep-alive\n\n"), 25_000);
  req.on("close", () => {
    clearInterval(keepAlive);
    unsubscribe();
  });
}

async function readUpload(
  req: IncomingMessage,
): Promise<{ uploads: UploadedImage[]; locale: string; options: JobOptions }> {
  const length = Number(req.headers["content-length"]);
  if (!Number.isFinite(length) || length > MAX_UPLOAD_BYTES)
    throw new HttpError(413, "upload too large");
  const request = new Request("http://localhost/", {
    method: "POST",
    headers: req.headers as Record<string, string>,
    body: Readable.toWeb(req) as ReadableStream,
    duplex: "half",
  } as RequestInit);
  const form = await request.formData().catch(() => {
    throw new HttpError(400, "invalid form data");
  });
  const files = form.getAll("images").filter((value) => typeof value !== "string");
  if (files.length === 0 || files.length > MAX_IMAGES)
    throw new HttpError(400, "expected 1 to 12 images");
  const uploads: UploadedImage[] = [];
  for (const file of files) {
    if (file.size > MAX_IMAGE_BYTES) throw new HttpError(413, `${file.name}: image too large`);
    uploads.push({
      name: file.name.slice(0, 120) || "photo",
      bytes: Buffer.from(await file.arrayBuffer()),
    });
  }
  const locale = String(form.get("locale") ?? "en");
  return {
    uploads,
    locale: LOCALE_PATTERN.test(locale) ? locale : "en",
    options: { browser: form.get("browser") === "1" },
  };
}

async function readJson(req: IncomingMessage): Promise<unknown> {
  let raw = "";
  for await (const chunk of req) {
    raw += String(chunk);
    if (raw.length > 16_384) throw new HttpError(413, "body too large");
  }
  try {
    return JSON.parse(raw);
  } catch {
    throw new HttpError(400, "invalid json");
  }
}

function json(res: ServerResponse, status: number, body: unknown) {
  res.writeHead(status, { "content-type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(body));
}
