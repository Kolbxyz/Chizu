// Browser-side photo handling: the copy sent to Claude, EXIF and zoom crops.
import { readExif } from "../../../shared/exif.ts";
import type { JobImage } from "../../../shared/job.ts";

/** Long edge of the copy sent to Claude, as on the server engine. */
const VIEW_EDGE = 1568;

export interface IngestedImage {
  image: JobImage;
  view: Blob;
}

export async function ingestImage(file: File): Promise<IngestedImage> {
  const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" }).catch(() => {
    throw new Error(`${file.name}: unreadable image`);
  });
  const view = await render(bitmap, { x: 0, y: 0, width: 1, height: 1 }, false);
  bitmap.close();
  return {
    image: {
      name: file.name.slice(0, 120) || "photo",
      width: view.width,
      height: view.height,
      exif: await readExif(file),
    },
    view: view.blob,
  };
}

export interface CropRequest {
  /** Fractions of the oriented image, 0 to 1. */
  x: number;
  y: number;
  width: number;
  height: number;
}

/** Full-resolution crop of the original, returned as base64 JPEG. */
export async function cropImage(original: Blob, crop: CropRequest): Promise<string> {
  const bitmap = await createImageBitmap(original, { imageOrientation: "from-image" });
  const { blob } = await render(bitmap, crop, true);
  bitmap.close();
  const bytes = new Uint8Array(await blob.arrayBuffer());
  let binary = "";
  for (let i = 0; i < bytes.length; i += 0x8000)
    binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(binary);
}

async function render(bitmap: ImageBitmap, crop: CropRequest, upscale: boolean) {
  const sx = Math.round(Math.min(1, Math.max(0, crop.x)) * bitmap.width);
  const sy = Math.round(Math.min(1, Math.max(0, crop.y)) * bitmap.height);
  const sw = Math.max(1, Math.min(bitmap.width - sx, Math.round(crop.width * bitmap.width)));
  const sh = Math.max(1, Math.min(bitmap.height - sy, Math.round(crop.height * bitmap.height)));
  const scale = Math.min(VIEW_EDGE / Math.max(sw, sh), upscale ? Infinity : 1);
  const width = Math.max(1, Math.round(sw * scale));
  const height = Math.max(1, Math.round(sh * scale));
  const canvas = new OffscreenCanvas(width, height);
  const context = canvas.getContext("2d");
  if (!context) throw new Error("canvas unavailable");
  context.drawImage(bitmap, sx, sy, sw, sh, 0, 0, width, height);
  return { blob: await canvas.convertToBlob({ type: "image/jpeg", quality: 0.88 }), width, height };
}
