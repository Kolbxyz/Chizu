// JSON requests of the research tools: a timeout, a size cap, and spacing per
// host for services whose usage policy limits the request rate.
import { ResearchError, type ResearchContext } from "./types.ts";

const TIMEOUT_MS = 30_000;
const MAX_CHARS = 8_000_000;
const queues = new Map<string, Promise<unknown>>();

export interface RequestOptions {
  /** Sent as a form POST when set. */
  form?: URLSearchParams;
  /** Minimum delay between two requests to the same host. */
  spacingMs?: number;
  /** Default 30 s. */
  timeoutMs?: number;
}

export function getJson<T>(
  url: string,
  ctx: ResearchContext,
  opts: RequestOptions = {},
): Promise<T> {
  const host = new URL(url).host;
  if (!opts.spacingMs) return request<T>(url, host, ctx, opts);
  const spacing = opts.spacingMs;
  const result = (queues.get(host) ?? Promise.resolve()).then(() =>
    request<T>(url, host, ctx, opts),
  );
  queues.set(
    host,
    result
      .catch(() => undefined)
      .then(() => new Promise((resolve) => setTimeout(resolve, spacing))),
  );
  return result;
}

async function request<T>(
  url: string,
  host: string,
  ctx: ResearchContext,
  opts: RequestOptions,
): Promise<T> {
  let response: Response;
  try {
    response = await fetch(url, {
      method: opts.form ? "POST" : "GET",
      body: opts.form,
      headers: { accept: "application/json", ...ctx.headers },
      signal: AbortSignal.any([ctx.signal, AbortSignal.timeout(opts.timeoutMs ?? TIMEOUT_MS)]),
    });
  } catch (err) {
    if (ctx.signal.aborted) throw err;
    throw new ResearchError(`${host} unreachable (${err instanceof Error ? err.name : "error"})`);
  }
  if (!response.ok) throw new ResearchError(`${host} answered HTTP ${response.status}`);
  const body = await response.text();
  if (body.length > MAX_CHARS) throw new ResearchError(`${host} answer too large`);
  try {
    return JSON.parse(body) as T;
  } catch {
    throw new ResearchError(`${host} did not answer JSON`);
  }
}
