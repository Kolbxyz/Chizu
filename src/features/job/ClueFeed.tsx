import type { Clue } from "../../../shared/schema.ts";
import { useI18n } from "../../i18n/context.ts";
import "./ClueFeed.css";

export function ClueFeed({ clues }: { clues: Clue[] }) {
  const { t } = useI18n();
  return (
    <section>
      <h3 className="panel-heading">
        {t("job.clues")} <span className="panel-heading__count">{clues.length}</span>
      </h3>
      {clues.length === 0 ? (
        <p className="panel-empty">{t("job.noClues")}</p>
      ) : (
        <ul className="clues">
          {clues.map((clue, i) => (
            <li key={i} className={`clue clue--${clue.category}`}>
              <span className="clue__category">{t(`clue.${clue.category}`)}</span>
              <span className="clue__text">{clue.text}</span>
              {clue.implies && <span className="clue__implies">→ {clue.implies}</span>}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
