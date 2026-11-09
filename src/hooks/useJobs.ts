import { useCallback, useEffect, useState } from "react";
import type { JobSummary } from "../../shared/job.ts";
import { toRef, type EngineId, type JobRef } from "../engines/types.ts";
import { useSettings } from "../settings/context.ts";

const POLL_MS = 3000;

export interface ListedJob extends JobSummary {
  engine: EngineId;
  ref: JobRef;
}

/** History of every engine available on this host, newest first; polls while a job runs. */
export function useJobs() {
  const { engines } = useSettings();
  const [jobs, setJobs] = useState<ListedJob[]>([]);

  const refresh = useCallback(() => {
    const lists = Object.values(engines).map((engine) =>
      engine.list().then(
        (list) => list.map((job) => ({ ...job, engine: engine.id, ref: toRef(engine.id, job.id) })),
        () => [] as ListedJob[], // An unreachable engine shows no history; the next poll retries.
      ),
    );
    void Promise.all(lists).then((all) =>
      setJobs(all.flat().sort((a, b) => b.createdAt - a.createdAt)),
    );
  }, [engines]);

  useEffect(refresh, [refresh]);

  const busy = jobs.some((job) => job.status === "queued" || job.status === "running");
  useEffect(() => {
    if (!busy) return;
    const timer = setInterval(refresh, POLL_MS);
    return () => clearInterval(timer);
  }, [busy, refresh]);

  return { jobs, refresh };
}
