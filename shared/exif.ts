// EXIF summary shared by the server and the browser engine. Missing or corrupt
// metadata is normal (screenshots, messaging apps): it yields an empty summary.
import exifr from "exifr";
import type { ExifSummary } from "./job.ts";

export const EXIF_OPTIONS = { gps: true, tiff: true, exif: true, xmp: false, icc: false };

export async function readExif(input: ArrayBuffer | Uint8Array | Blob): Promise<ExifSummary> {
  // exifr is CommonJS in Node: its named `parse` export is not reachable from ESM.
  // oxlint-disable-next-line import/no-named-as-default-member
  const raw = (await exifr.parse(input, EXIF_OPTIONS).catch(() => undefined)) as
    Record<string, unknown> | undefined;
  return raw ? summarizeExif(raw) : {};
}

export function summarizeExif(raw: Record<string, unknown>): ExifSummary {
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
