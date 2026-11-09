import { useState } from "react";
import { Check, Copy, ExternalLink } from "lucide-react";
import type { Candidate } from "../../../shared/schema.ts";
import { useI18n } from "../../i18n/context.ts";
import { formatCoords, formatDistance, formatPercent } from "../../lib/format.ts";
import "./CandidateList.css";

export function CandidateList({ candidates }: { candidates: Candidate[] }) {
  const { t, locale } = useI18n();
  const best = candidates[0];
  return (
    <section className="candidates">
      <h3 className="panel-heading">{t("job.candidates")}</h3>
      <ol className="candidates__list">
        {candidates.map((c, i) => (
          <li key={c.id} className={`candidates__item${i === 0 ? " candidates__item--best" : ""}`}>
            <div className="candidates__row">
              <span className="candidates__label">{c.label}</span>
              <span className="candidates__radius">
                {t("job.radius", { value: formatDistance(c.radius_m, locale) })}
              </span>
            </div>
            <div className="candidates__bar" aria-hidden>
              <span style={{ width: `${Math.round(c.confidence * 100)}%` }} />
            </div>
            <span className="candidates__confidence">
              {t("job.confidence", { value: formatPercent(c.confidence, locale) })}
            </span>
          </li>
        ))}
      </ol>
      {best && <ResultActions candidate={best} />}
    </section>
  );
}

function ResultActions({ candidate }: { candidate: Candidate }) {
  const { t } = useI18n();
  const [copied, setCopied] = useState(false);
  const coords = formatCoords(candidate.lat, candidate.lng);
  const ll = `${candidate.lat},${candidate.lng}`;
  const links = [
    {
      label: t("result.googleMaps"),
      href: `https://www.google.com/maps/search/?api=1&query=${ll}`,
    },
    {
      label: t("result.streetView"),
      href: `https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=${ll}`,
    },
    {
      label: t("result.osm"),
      href: `https://www.openstreetmap.org/?mlat=${candidate.lat}&mlon=${candidate.lng}#map=17/${candidate.lat}/${candidate.lng}`,
    },
  ];
  const copy = () => {
    navigator.clipboard.writeText(coords).then(
      () => {
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      },
      () => undefined, // Clipboard permission denied: the coordinates stay visible.
    );
  };
  return (
    <div className="result">
      <button type="button" className="result__coords" onClick={copy} title={t("result.copy")}>
        <code>{coords}</code>
        {copied ? <Check size={14} aria-hidden /> : <Copy size={14} aria-hidden />}
        <span className="visually-hidden">{copied ? t("result.copied") : t("result.copy")}</span>
      </button>
      <div className="result__links">
        {links.map((link) => (
          <a key={link.label} href={link.href} target="_blank" rel="noopener noreferrer">
            {link.label} <ExternalLink size={12} aria-hidden />
          </a>
        ))}
      </div>
    </div>
  );
}
