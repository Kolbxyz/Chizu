import { Loader2 } from "lucide-react";
import type { JobStatus } from "../../shared/job.ts";
import { useI18n } from "../i18n/context.ts";
import "./StatusPill.css";

export function StatusPill({ status }: { status: JobStatus }) {
  const { t } = useI18n();
  return (
    <span className={`status-pill status-pill--${status}`}>
      {status === "running" && <Loader2 className="status-pill__spin" size={12} aria-hidden />}
      {t(`status.${status}`)}
    </span>
  );
}
