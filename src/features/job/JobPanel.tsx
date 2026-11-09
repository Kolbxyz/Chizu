import { CircleStop } from "lucide-react";
import type { Job } from "../../../shared/job.ts";
import { RichText } from "../../components/RichText.tsx";
import { StatusPill } from "../../components/StatusPill.tsx";
import { useI18n } from "../../i18n/context.ts";
import { api } from "../../lib/api.ts";
import type { JobView } from "../../lib/derive.ts";
import { formatCost, formatDuration } from "../../lib/format.ts";
import { ActivityLog } from "./ActivityLog.tsx";
import { CandidateList } from "./CandidateList.tsx";
import { ClueFeed } from "./ClueFeed.tsx";
import { HintBox } from "./HintBox.tsx";
import { PhotoStrip } from "./PhotoStrip.tsx";
import { PrecisionLadder } from "./PrecisionLadder.tsx";
import { Timeline } from "./Timeline.tsx";
import "./JobPanel.css";

interface Props {
  job: Job;
  view: JobView;
  /** Estimate index shown on the map; null follows the latest one. */
  pinned: number | null;
  onPin: (index: number | null) => void;
}

export function JobPanel({ job, view, pinned, onPin }: Props) {
  const { t, locale } = useI18n();
  const shown = view.estimates[pinned ?? view.estimates.length - 1]?.estimate;
  const active = job.status === "running" || job.status === "queued";
  return (
    <div className="job-panel">
      <PhotoStrip job={job} />

      <div className="job-panel__status">
        <StatusPill status={job.status} />
        {view.usage.turns > 0 && (
          <span className="job-panel__usage">
            {t("job.cost", {
              cost: formatCost(view.usage.costUsd, locale),
              turns: view.usage.turns,
              duration: formatDuration(view.usage.durationMs, locale),
            })}
          </span>
        )}
        {active && (
          <button type="button" className="job-panel__stop" onClick={() => void api.cancel(job.id)}>
            <CircleStop size={14} aria-hidden /> {t("job.stop")}
          </button>
        )}
      </div>

      {job.status === "error" && view.error && (
        <p className="job-panel__error" role="alert">
          {t("job.error", { message: view.error })}
        </p>
      )}

      <div className="job-panel__card">
        <PrecisionLadder level={shown?.level} />
        <Timeline count={view.estimates.length} index={pinned} onChange={onPin} />
        {shown ? (
          <>
            <p className="job-panel__summary">{shown.summary}</p>
            <CandidateList candidates={shown.candidates} />
          </>
        ) : (
          <p className="panel-empty">{t("job.waiting")}</p>
        )}
      </div>

      {view.answer && !active && (
        <section className="job-panel__card job-panel__answer">
          <h3 className="panel-heading">{t("job.answer")}</h3>
          <RichText text={view.answer} />
        </section>
      )}

      <HintBox jobId={job.id} />
      <ClueFeed clues={view.clues} />
      <ActivityLog events={view.activity} />
    </div>
  );
}
