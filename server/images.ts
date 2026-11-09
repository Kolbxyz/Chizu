// Image ingestion: validation, metadata extraction, the copy sent to Claude and
// full-resolution crops for the zoom tool.
import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import sharp from "sharp";
import { readExif } from "../shared/exif.ts";
import type { JobImage } from "../shared/job.ts";
import type { ZoomRequest } from "../shared/schema.ts";

type CropRequest = Omit<ZoomRequest, "image">;

/** Long edge of the copy sent to Claude; larger images are downscaled by the API anyway. */
export const VIEW_EDGE = 1568;
const ACCEPTED_FORMATS = new Set(["jpeg", "png", "webp", "gif", "tiff", "avif"]);

export class ImageRejected extends Error {}

export const originalPath = (dir: string, index: number) => join(dir, `${index}.orig`);
export const viewPath = (dir: string, index: number) => join(dir, `${index}.jpg`);

/** Validates an uploaded file and writes its original and view copies into `dir`. */
export async function ingestImage(
  dir: string,
  index: number,
  name: string,
  bytes: Buffer,
): Promise<JobImage> {
  const meta = await sharp(bytes)
    .metadata()
    .catch(() => {
      throw new ImageRejected(`${name}: unreadable image`);
    });
  if (!meta.format || !ACCEPTED_FORMATS.has(meta.format)) {
    throw new ImageRejected(`${name}: unsupported format ${meta.format ?? "unknown"}`);
  }
  await writeFile(originalPath(dir, index), bytes);
  const view = await sharp(bytes)
    .rotate()
    .resize(VIEW_EDGE, VIEW_EDGE, { fit: "inside", withoutEnlargement: true })
    .jpeg({ quality: 88 })
    .toBuffer({ resolveWithObject: true });
  await writeFile(viewPath(dir, index), view.data);
  return { name, width: view.info.width, height: view.info.height, exif: await readExif(bytes) };
}

/** Crops the full-resolution original and returns a JPEG no larger than the view edge. */
export async function cropOriginal(dir: string, index: number, crop: CropRequest): Promise<Buffer> {
  const oriented = await sharp(await readFile(originalPath(dir, index)))
    .rotate()
    .toBuffer({ resolveWithObject: true });
  const { width: w, height: h } = oriented.info;
  const left = Math.min(w - 1, Math.max(0, Math.round(crop.x * w)));
  const top = Math.min(h - 1, Math.max(0, Math.round(crop.y * h)));
  const width = Math.max(1, Math.min(w - left, Math.round(crop.width * w)));
  const height = Math.max(1, Math.min(h - top, Math.round(crop.height * h)));
  const cropped = sharp(oriented.data)
    .extract({ left, top, width, height })
    .resize(VIEW_EDGE, VIEW_EDGE, { fit: "inside" });
  // Same stretch as the browser engine: 1st and 99th luminance percentiles to full range.
  if (crop.enhance) cropped.normalise({ lower: 1, upper: 99 });
  return cropped.jpeg({ quality: 90 }).toBuffer();
}

/** Reads an image file and returns an oriented JPEG no larger than the view edge. */
export async function toViewJpeg(path: string): Promise<Buffer> {
  return sharp(await readFile(path), { limitInputPixels: 200_000_000 })
    .rotate()
    .resize(VIEW_EDGE, VIEW_EDGE, { fit: "inside", withoutEnlargement: true })
    .jpeg({ quality: 88 })
    .toBuffer();
}
