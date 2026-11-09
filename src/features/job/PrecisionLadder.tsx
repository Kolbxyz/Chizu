import { PRECISION_LEVELS, type PrecisionLevel } from "../../../shared/schema.ts";
import { useI18n } from "../../i18n/context.ts";
import "./PrecisionLadder.css";

/** The eight precision steps, filled up to the current level. */
export function PrecisionLadder({ level }: { level?: PrecisionLevel }) {
  const { t } = useI18n();
  const reached = level ? PRECISION_LEVELS.indexOf(level) : -1;
  return (
    <div className="ladder">
      <div className="ladder__head">
        <span>{t("job.precision")}</span>
        <strong>{level ? t(`level.${level}`) : "—"}</strong>
      </div>
      <ol className="ladder__steps" aria-label={t("job.precision")}>
        {PRECISION_LEVELS.map((step, i) => (
          <li
            key={step}
            className={`ladder__step${i <= reached ? " ladder__step--on" : ""}${i === reached ? " ladder__step--current" : ""}`}
            aria-current={i === reached ? "step" : undefined}
            title={t(`level.${step}`)}
          >
            <span className="visually-hidden">{t(`level.${step}`)}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}
