import {
  CircleAlert,
  CircleCheck,
  CircleStop,
  Globe,
  Lightbulb,
  MessageSquare,
  Play,
  Search,
  ZoomIn,
  type LucideIcon,
} from "lucide-react";
import type { ReactNode } from "react";
import { RichText } from "../../components/RichText.tsx";
import { useI18n } from "../../i18n/context.ts";
import type { ActivityEvent } from "../../lib/derive.ts";
import { hostOf } from "../../lib/format.ts";
import "./ActivityLog.css";

/** Chronological trace of what Claude did: searches, pages read, zooms, notes. */
export function ActivityLog({ events }: { events: ActivityEvent[] }) {
  const { t } = useI18n();
  const row = (event: ActivityEvent): [LucideIcon, ReactNode] | undefined => {
    switch (event.kind) {
      case "search":
        return [Search, t("activity.search", { query: event.query })];
      case "fetch":
        return [Globe, t("activity.fetch", { host: hostOf(event.url) })];
      case "zoom":
        return [ZoomIn, t("activity.zoom", { index: event.image })];
      case "hint":
        return [Lightbulb, t("activity.hint", { text: event.text })];
      case "thought":
        return [MessageSquare, <RichText key="text" text={event.text} />];
      case "status":
        if (event.status === "running") return [Play, t("activity.running")];
        if (event.status === "done") return [CircleCheck, t("activity.done")];
        if (event.status === "cancelled") return [CircleStop, t("activity.cancelled")];
        if (event.status === "error")
          return [CircleAlert, t("activity.error", { message: event.message ?? "" })];
        return undefined;
    }
  };
  return (
    <section>
      <h3 className="panel-heading">{t("job.activity")}</h3>
      <ol className="activity">
        {events.map((event, i) => {
          const content = row(event);
          if (!content) return null;
          const [Icon, body] = content;
          return (
            <li key={i} className={`activity__item activity__item--${event.kind}`}>
              <span className="activity__icon" aria-hidden>
                <Icon size={14} />
              </span>
              <div className="activity__body">{body}</div>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
