import { Radio } from "lucide-react";
import { useI18n } from "../../i18n/context.ts";
import "./Timeline.css";

interface Props {
  count: number;
  /** Index shown on the map; null follows the latest estimate. */
  index: number | null;
  onChange: (index: number | null) => void;
}

/** Scrubber over the estimate history, to replay how the location narrowed down. */
export function Timeline({ count, index, onChange }: Props) {
  const { t } = useI18n();
  if (count < 2) return null;
  const shown = index ?? count - 1;
  return (
    <div className="timeline">
      <input
        type="range"
        min={0}
        max={count - 1}
        value={shown}
        aria-label={t("timeline.label", { index: shown + 1, count })}
        onChange={(e) => {
          const next = Number(e.target.value);
          onChange(next === count - 1 ? null : next);
        }}
      />
      <span className="timeline__label">{t("timeline.label", { index: shown + 1, count })}</span>
      <button
        type="button"
        className="timeline__live"
        aria-pressed={index === null}
        onClick={() => onChange(null)}
      >
        <Radio size={13} aria-hidden /> {t("timeline.live")}
      </button>
    </div>
  );
}
