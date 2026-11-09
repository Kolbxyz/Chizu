import { useRef, useState } from "react";
import { ImagePlus, Loader2 } from "lucide-react";
import { imagesOf, useWindowFileDrop } from "../../hooks/useWindowFileDrop.ts";
import { useI18n } from "../../i18n/context.ts";
import { UploadTray } from "./UploadTray.tsx";
import "./Dropzone.css";

const MAX_FILES = 12;
const sameFile = (a: File, b: File) =>
  a.name === b.name && a.size === b.size && a.lastModified === b.lastModified;

interface Props {
  busy: boolean;
  /**
   * `together`: every photo shows the same place and is analysed as one job.
   * Returns false when the analysis cannot start; the photos then stay in the tray.
   */
  onSubmit: (files: File[], together: boolean) => boolean;
}

/** Collects photos into a tray; nothing is analysed until the user starts it. */
export function Dropzone({ busy, onSubmit }: Props) {
  const { t } = useI18n();
  const input = useRef<HTMLInputElement>(null);
  const [staged, setStaged] = useState<File[]>([]);

  const add = (files: File[]) =>
    setStaged((current) =>
      [...current, ...files.filter((f) => !current.some((c) => sameFile(c, f)))].slice(
        0,
        MAX_FILES,
      ),
    );
  const dragging = useWindowFileDrop(add);

  const start = (together: boolean) => {
    if (onSubmit(staged, together)) setStaged([]);
  };

  return (
    <>
      <button
        type="button"
        className={`dropzone${staged.length > 0 ? " dropzone--compact" : ""}`}
        disabled={busy || staged.length >= MAX_FILES}
        onClick={() => input.current?.click()}
      >
        <span className="dropzone__icon" aria-hidden>
          {busy ? <Loader2 className="dropzone__spin" size={22} /> : <ImagePlus size={22} />}
        </span>
        <span className="dropzone__text">
          <strong>
            {busy
              ? t("upload.sending")
              : staged.length > 0
                ? t("upload.addMore")
                : t("upload.title")}
          </strong>
          <span>{t("upload.subtitle")}</span>
          <small>{t("upload.formats")}</small>
        </span>
      </button>
      {staged.length > 0 && (
        <UploadTray
          files={staged}
          busy={busy}
          onRemove={(file) => setStaged((current) => current.filter((f) => f !== file))}
          onClear={() => setStaged([])}
          onStart={start}
        />
      )}
      <input
        ref={input}
        className="visually-hidden"
        type="file"
        accept="image/jpeg,image/png,image/webp,image/avif,image/gif,image/tiff"
        multiple
        tabIndex={-1}
        aria-hidden
        onChange={(e) => {
          add(imagesOf(e.target.files));
          e.target.value = "";
        }}
      />
      {dragging && (
        <div className="drop-overlay" aria-hidden>
          <div className="drop-overlay__card">
            <ImagePlus size={40} />
            <span>{t("upload.title")}</span>
          </div>
        </div>
      )}
    </>
  );
}
