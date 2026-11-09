import { useCallback, useMemo, useState } from "react";
import { MapPinned } from "lucide-react";
import type { JobEvent } from "../shared/job.ts";
import { JobList } from "./features/history/JobList.tsx";
import { JobPanel } from "./features/job/JobPanel.tsx";
import { Preferences } from "./features/shell/Preferences.tsx";
import { GeoMap } from "./features/map/GeoMap.tsx";
import { Dropzone } from "./features/upload/Dropzone.tsx";
import { useSelectedJob } from "./hooks/useHashRoute.ts";
import { useJobs } from "./hooks/useJobs.ts";
import { useTheme } from "./hooks/useTheme.ts";
import { useJobStream } from "./hooks/useJobStream.ts";
import { useI18n } from "./i18n/context.ts";
import { MissingApiKeyError } from "./engines/browser/engine.ts";
import { parseRef, toRef, type JobRef } from "./engines/types.ts";
import { deriveJob } from "./lib/derive.ts";
import { useSettings } from "./settings/context.ts";
import { SettingsDialog } from "./settings/SettingsDialog.tsx";
import "./App.css";

export function App() {
  const { t, locale } = useI18n();
  const { theme, toggle } = useTheme();
  const { jobs, refresh } = useJobs();
  const [selected, select] = useSelectedJob();
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string>();
  const [pinned, setPinned] = useState<{ job: string; index: number } | null>(null);
  const settings = useSettings();
  const [settingsNotice, setSettingsNotice] = useState<string>();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const openSettings = (notice?: string) => {
    setSettingsNotice(notice);
    setSettingsOpen(true);
  };
  const selectedEngine = selected
    ? settings.engines[parseRef(selected)?.engine ?? "cc"]
    : undefined;

  const onEvent = useCallback((event: JobEvent) => event.kind === "status" && refresh(), [refresh]);
  const job = useJobStream(selected, onEvent);
  const view = useMemo(() => (job ? deriveJob(job) : undefined), [job]);

  const pinnedIndex = pinned && pinned.job === selected ? pinned.index : null;
  const shownIndex = view ? (pinnedIndex ?? view.estimates.length - 1) : -1;
  const shown = view?.estimates[shownIndex]?.estimate;
  const exif = useMemo(() => job?.images.map((image) => image.exif) ?? [], [job?.images]);

  const engine = settings.engines[settings.engine];

  /** Starts the analysis; returns false (photos stay staged) when it cannot start. */
  const submit = (files: File[], together: boolean): boolean => {
    if (!engine) return false;
    if (engine.id === "api" && !settings.apiKey) {
      openSettings(t("settings.needKey"));
      return false;
    }
    void upload(files, together);
    return true;
  };

  const upload = async (files: File[], together: boolean) => {
    if (!engine) return;
    setUploading(true);
    setUploadError(undefined);
    try {
      const groups = together ? [files] : files.map((file) => [file]);
      const created = [];
      for (const group of groups) created.push(await engine.create(group, locale));
      if (created[0]) select(toRef(engine.id, created[0].id));
    } catch (err) {
      if (err instanceof MissingApiKeyError) openSettings(t("settings.needKey"));
      else setUploadError(err instanceof Error ? err.message : String(err));
    } finally {
      setUploading(false);
      refresh();
    }
  };

  const remove = async (ref: JobRef) => {
    const target = parseRef(ref);
    const owner = target ? settings.engines[target.engine] : undefined;
    if (target && owner) await owner.remove(target.id).catch(() => undefined); // The refreshed list shows the outcome.
    if (ref === selected) select(undefined);
    refresh();
  };
  const engineLabel =
    settings.engine === "cc"
      ? t("settings.cc.name")
      : `API · ${settings.model === "claude-opus-5-5" ? "Opus 5.5" : "Sonnet 5.5"}`;

  return (
    <div className="app">
      <aside className="sidebar">
        <header className="topbar">
          <h1 className="topbar__title">
            {t("app.title.before")}
            <em>{t("app.title.em")}</em>
            {t("app.title.after")}
          </h1>
        </header>
        <Dropzone busy={uploading} onSubmit={submit} />
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
        <Preferences
          theme={theme}
          onToggleTheme={toggle}
          engineLabel={engineLabel}
          onOpenSettings={() => openSettings()}
        />
      </aside>

      <main className="stage">
        <GeoMap estimate={shown} exif={exif} dark={theme === "dark"} />
      </main>

      <aside className="inspector" aria-live="polite">
        {job && view && selectedEngine ? (
          <JobPanel
            job={job}
            engine={selectedEngine}
            view={view}
            pinned={pinnedIndex}
            onPin={(index) => setPinned(index === null ? null : { job: selected ?? "", index })}
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
      <SettingsDialog
        open={settingsOpen}
        notice={settingsNotice}
        onClose={() => setSettingsOpen(false)}
      />
    </div>
  );
}
