// Image ingestion: validation, metadata extraction, the copy sent to Claude and
// full-resolution crops for the zoom tool.
import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import exifr from "exifr";
import sharp from "sharp";
import type { ExifSummary, JobImage } from "../shared/job.ts";

/** Long edge of the copy sent to Claude; larger images are downscaled by the API anyway. */
const VIEW_EDGE = 1568;
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

async function readExif(bytes: Buffer): Promise<ExifSummary> {
  // Missing or corrupt metadata is normal for screenshots and messaging apps.
  // exifr is CommonJS: its named `parse` export is not reachable from Node ESM.
  // oxlint-disable-next-line import/no-named-as-default-member
  const raw: Record<string, unknown> | undefined = await exifr
    .parse(bytes, {
      gps: true,
      tiff: true,
      exif: true,
      xmp: false,
      icc: false,
    })
    .catch(() => undefined);
  if (!raw) return {};
  const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : undefined);
  const str = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : undefined);
  const taken = raw.DateTimeOriginal ?? raw.CreateDate;
  const camera = [str(raw.Make), str(raw.Model)].filter(Boolean).join(" ");
  const summary: ExifSummary = {
    lat: num(raw.latitude),
    lng: num(raw.longitude),
    altitude: num(raw.GPSAltitude),
    heading: num(raw.GPSImgDirection),
    takenAt:
      taken instanceof Date && !Number.isNaN(taken.getTime()) ? taken.toISOString() : undefined,
    camera: camera || undefined,
    lens: str(raw.LensModel),
    software: str(raw.Software),
  };
  return Object.fromEntries(Object.entries(summary).filter(([, v]) => v !== undefined));
}

export interface CropRequest {
  /** Fractions of the oriented image, 0 to 1. */
  x: number;
  y: number;
  width: number;
  height: number;
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
  return sharp(oriented.data)
    .extract({ left, top, width, height })
    .resize(VIEW_EDGE, VIEW_EDGE, { fit: "inside" })
    .jpeg({ quality: 90 })
    .toBuffer();
}
