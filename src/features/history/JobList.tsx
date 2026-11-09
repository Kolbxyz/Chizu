import { Trash2 } from "lucide-react";
import type { JobSummary } from "../../../shared/job.ts";
import { StatusPill } from "../../components/StatusPill.tsx";
import { useI18n } from "../../i18n/context.ts";
import { api } from "../../lib/api.ts";
import { formatDate } from "../../lib/format.ts";
import "./JobList.css";

interface Props {
  jobs: JobSummary[];
  selected?: string;
  onSelect: (id: string) => void;
  onDelete: (id: string) => void;
}

export function JobList({ jobs, selected, onSelect, onDelete }: Props) {
  const { t, locale } = useI18n();
  return (
    <section className="job-list" aria-labelledby="job-list-title">
      <h2 id="job-list-title" className="job-list__title">
        {t("history.title")}
      </h2>
      {jobs.length === 0 && <p className="job-list__empty">{t("history.empty")}</p>}
      <ul className="job-list__items">
        {jobs.map((job) => (
          <li
            key={job.id}
            className="job-list__item"
            aria-current={job.id === selected || undefined}
          >
            <button type="button" className="job-list__open" onClick={() => onSelect(job.id)}>
              <img
                className="job-list__thumb"
                src={api.imageUrl(job.id, 0)}
                alt=""
                width={52}
                height={52}
                loading="lazy"
              />
              <span className="job-list__body">
                <span className="job-list__place">{job.place ?? t("history.unknownPlace")}</span>
                <span className="job-list__meta">
                  <StatusPill status={job.status} />
                  {job.level && <span className="job-list__level">{t(`level.${job.level}`)}</span>}
                </span>
                <span className="job-list__date">
                  {formatDate(job.createdAt, locale)}
                  {job.imageCount > 1 && ` · ${t("history.photos", { count: job.imageCount })}`}
                </span>
              </span>
            </button>
            <button
              type="button"
              className="job-list__delete"
              aria-label={t("history.delete")}
              title={t("history.delete")}
              onClick={() => onDelete(job.id)}
            >
              <Trash2 size={15} aria-hidden />
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
