import { useCallback, useMemo, useState } from "react";
import { MapPinned } from "lucide-react";
import type { JobEvent } from "../shared/job.ts";
import { JobList } from "./features/history/JobList.tsx";
import { JobPanel } from "./features/job/JobPanel.tsx";
import { HeaderTools } from "./features/shell/HeaderTools.tsx";
import { GeoMap } from "./features/map/GeoMap.tsx";
import { Dropzone } from "./features/upload/Dropzone.tsx";
import { useSelectedJob } from "./hooks/useHashRoute.ts";
import { useJobs } from "./hooks/useJobs.ts";
import { useTheme } from "./hooks/useTheme.ts";
import { useJobStream } from "./hooks/useJobStream.ts";
import { useI18n } from "./i18n/context.ts";
import { api } from "./lib/api.ts";
import { deriveJob } from "./lib/derive.ts";
import "./App.css";

export function App() {
  const { t, locale } = useI18n();
  const { theme, toggle } = useTheme();
  const { jobs, refresh } = useJobs();
  const [selected, select] = useSelectedJob();
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string>();
  const [pinned, setPinned] = useState<{ job: string; index: number } | null>(null);

  const onEvent = useCallback((event: JobEvent) => event.kind === "status" && refresh(), [refresh]);
  const job = useJobStream(selected, onEvent);
  const view = useMemo(() => (job ? deriveJob(job) : undefined), [job]);

  const pinnedIndex = pinned && pinned.job === selected ? pinned.index : null;
  const shownIndex = view ? (pinnedIndex ?? view.estimates.length - 1) : -1;
  const shown = view?.estimates[shownIndex]?.estimate;
  const exif = useMemo(() => job?.images.map((image) => image.exif) ?? [], [job?.images]);

  const upload = async (files: File[], together: boolean) => {
    setUploading(true);
    setUploadError(undefined);
    try {
      const groups = together ? [files] : files.map((file) => [file]);
      const created = [];
      for (const group of groups) created.push(await api.create(group, locale));
      if (created[0]) select(created[0].id);
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : String(err));
    } finally {
      setUploading(false);
      refresh();
    }
  };

  const remove = async (id: string) => {
    await api.remove(id).catch(() => undefined); // The refreshed list shows the outcome.
    if (id === selected) select(undefined);
    refresh();
  };

  return (
    <div className="app">
      <aside className="sidebar">
        <header className="topbar">
          <div className="topbar__row">
            <p className="topbar__eyebrow">{t("app.eyebrow")}</p>
            <HeaderTools theme={theme} onToggleTheme={toggle} />
          </div>
          <h1 className="topbar__title">
            {t("app.title.before")}
            <em>{t("app.title.em")}</em>
            {t("app.title.after")}
          </h1>
        </header>
        <Dropzone busy={uploading} onSubmit={(files, together) => void upload(files, together)} />
        {uploadError && (
          <p className="sidebar__error" role="alert">
            {t("upload.failed", { message: uploadError })}
          </p>
        )}
        <JobList
          jobs={jobs}
          selected={selected}
          onSelect={select}
          onDelete={(id) => void remove(id)}
        />
      </aside>

      <main className="stage">
        <GeoMap estimate={shown} exif={exif} dark={theme === "dark"} />
      </main>

      <aside className="inspector" aria-live="polite">
        {job && view ? (
          <JobPanel
            job={job}
            view={view}
            pinned={pinnedIndex}
            onPin={(index) => setPinned(index === null ? null : { job: job.id, index })}
          />
        ) : (
          <div className="inspector__empty">
            <span className="inspector__badge" aria-hidden>
              <MapPinned size={30} />
            </span>
            <h2>{t("job.empty.title")}</h2>
            <p>{t("job.empty.body")}</p>
          </div>
        )}
      </aside>
    </div>
  );
}
