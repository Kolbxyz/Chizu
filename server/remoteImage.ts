// Downloads an image a research tool points at, for the Claude Code engine.
// URLs can come from web pages Claude read (prompt injection), so only public
// https hosts are reached, each redirect is checked again, and only bytes that
// decode as an image are returned, re-encoded as a JPEG.
import sharp from "sharp";
import { VIEW_EDGE } from "./images.ts";
import { BlockedHostError, resolvePublic } from "./netGuard.ts";

const MAX_BYTES = 25 * 1024 * 1024;
const MAX_REDIRECTS = 4;
const TIMEOUT_MS = 30_000;

export class RemoteImageError extends Error {}

async function assertPublic(url: URL): Promise<void> {
  if (url.protocol !== "https:") throw new RemoteImageError("only https URLs are allowed");
  await resolvePublic(url.hostname).catch((err: unknown) => {
    throw err instanceof BlockedHostError ? new RemoteImageError(err.message) : err;
  });
}

async function download(start: string, headers: Record<string, string>): Promise<Buffer> {
  let url = new URL(start);
  for (let hop = 0; hop <= MAX_REDIRECTS; hop += 1) {
    await assertPublic(url);
    const response = await fetch(url, {
      headers: { accept: "image/*", ...headers },
      redirect: "manual",
      signal: AbortSignal.timeout(TIMEOUT_MS),
    }).catch((err: unknown) => {
      throw new RemoteImageError(
        `${url.host} unreachable (${err instanceof Error ? err.name : "error"})`,
      );
    });
    const location = response.headers.get("location");
    if (response.status >= 300 && response.status < 400 && location) {
      url = new URL(location, url);
      continue;
    }
    if (!response.ok) throw new RemoteImageError(`${url.host} answered HTTP ${response.status}`);
    if (Number(response.headers.get("content-length")) > MAX_BYTES)
      throw new RemoteImageError("image too large");
    const chunks: Buffer[] = [];
    let size = 0;
    for await (const chunk of response.body ?? []) {
      size += chunk.length;
      if (size > MAX_BYTES) throw new RemoteImageError("image too large");
      chunks.push(Buffer.from(chunk));
    }
    return Buffer.concat(chunks);
  }
  throw new RemoteImageError("too many redirects");
}

/** Fetches `url` and returns a JPEG no larger than the view edge, as base64. */
export async function fetchRemoteImage(
  url: string,
  headers: Record<string, string>,
): Promise<string> {
  const bytes = await download(url, headers);
  const jpeg = await sharp(bytes, { limitInputPixels: 200_000_000 })
    .rotate()
    .resize(VIEW_EDGE, VIEW_EDGE, { fit: "inside", withoutEnlargement: true })
    .jpeg({ quality: 85 })
    .toBuffer()
    .catch(() => {
      throw new RemoteImageError("the URL does not point to a readable image");
    });
  return jpeg.toString("base64");
}
