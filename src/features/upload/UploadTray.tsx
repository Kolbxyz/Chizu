import { useEffect, useRef, useState } from "react";
import { Play, X } from "lucide-react";
import { useI18n } from "../../i18n/context.ts";
import "./UploadTray.css";

interface Props {
  files: File[];
  busy: boolean;
  onRemove: (file: File) => void;
  onClear: () => void;
  onStart: (together: boolean) => void;
}

/** Photos waiting to be analysed, with the choice between one joint or separate analyses. */
export function UploadTray({ files, busy, onRemove, onClear, onStart }: Props) {
  const { t } = useI18n();
  const [together, setTogether] = useState(true);

  const many = files.length > 1;
  const label = many
    ? t(together ? "upload.analyzeTogether" : "upload.analyzeSeparately", { count: files.length })
    : t("upload.analyze");
  return (
    <section className="tray" aria-label={t("upload.trayLabel")}>
      <ul className="tray__grid">
        {files.map((file) => (
          <li key={`${file.name}-${file.size}-${file.lastModified}`} className="tray__item">
            <Thumb file={file} />
            <button
              type="button"
              className="tray__remove"
              aria-label={t("upload.remove", { name: file.name })}
              onClick={() => onRemove(file)}
            >
              <X size={13} aria-hidden />
            </button>
          </li>
        ))}
      </ul>
      {many && (
        <label className="tray__together">
          <input
            type="checkbox"
            checked={together}
            onChange={(e) => setTogether(e.target.checked)}
          />
          <span>
            <strong>{t("upload.together")}</strong>
            <small>{together ? t("upload.togetherHint") : t("upload.separateHint")}</small>
          </span>
        </label>
      )}
      <div className="tray__actions">
        <button
          type="button"
          className="tray__start"
          onClick={() => onStart(many && together)}
          disabled={busy}
        >
          <Play size={15} aria-hidden />
          {label}
        </button>
        <button type="button" className="tray__clear" onClick={onClear} disabled={busy}>
          {t("upload.clear")}
        </button>
      </div>
    </section>
  );
}

/** Local preview; the object URL lives exactly as long as this element. */
function Thumb({ file }: { file: File }) {
  const img = useRef<HTMLImageElement>(null);
  useEffect(() => {
    const url = URL.createObjectURL(file);
    if (img.current) img.current.src = url;
    return () => URL.revokeObjectURL(url);
  }, [file]);
  return <img ref={img} alt={file.name} width={72} height={72} />;
}
