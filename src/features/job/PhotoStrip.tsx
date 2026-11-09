import { useEffect, useRef, useState } from "react";
import { Camera, Compass, MapPin, X } from "lucide-react";
import type { Job } from "../../../shared/job.ts";
import { useI18n } from "../../i18n/context.ts";
import { api } from "../../lib/api.ts";
import { formatCoords, formatDate } from "../../lib/format.ts";
import "./PhotoStrip.css";

export function PhotoStrip({ job }: { job: Job }) {
  const { t, locale } = useI18n();
  const [open, setOpen] = useState<number | null>(null);
  const dialog = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    if (open === null) dialog.current?.close();
    else dialog.current?.showModal();
  }, [open]);

  const current = open === null ? undefined : job.images[open];
  return (
    <section className="photos">
      <div className={`photos__grid photos__grid--${Math.min(job.images.length, 3)}`}>
        {job.images.map((image, i) => (
          <button
            key={i}
            type="button"
            className="photos__item"
            aria-label={t("job.openPhoto", { index: i + 1 })}
            onClick={() => setOpen(i)}
          >
            <img src={api.imageUrl(job.id, i)} alt="" width={image.width} height={image.height} />
            {image.exif.lat !== undefined && (
              <span className="photos__gps" title={t("map.exif")}>
                <MapPin size={12} aria-hidden /> GPS
              </span>
            )}
          </button>
        ))}
      </div>
      <dialog
        ref={dialog}
        className="lightbox"
        onClose={() => setOpen(null)}
        onClick={(e) => e.target === e.currentTarget && setOpen(null)}
      >
        {current && open !== null && (
          <figure className="lightbox__figure">
            <img
              src={api.imageUrl(job.id, open)}
              alt={t("job.photo", { index: open + 1 })}
              width={current.width}
              height={current.height}
            />
            <figcaption className="lightbox__caption">
              <strong>{current.name}</strong>
              {current.exif.takenAt && <span>{formatDate(current.exif.takenAt, locale)}</span>}
              {current.exif.camera && (
                <span>
                  <Camera size={13} aria-hidden /> {current.exif.camera}
                </span>
              )}
              {current.exif.lat !== undefined && current.exif.lng !== undefined && (
                <span>
                  <MapPin size={13} aria-hidden />{" "}
                  {formatCoords(current.exif.lat, current.exif.lng)}
                </span>
              )}
              {current.exif.heading !== undefined && (
                <span>
                  <Compass size={13} aria-hidden /> {Math.round(current.exif.heading)}°
                </span>
              )}
            </figcaption>
            <button
              type="button"
              className="lightbox__close"
              aria-label={t("job.closePhoto")}
              onClick={() => setOpen(null)}
            >
              <X size={20} aria-hidden />
            </button>
          </figure>
        )}
      </dialog>
    </section>
  );
}
