import { useCallback, useEffect, useState } from "react";
import type { JobSummary } from "../../shared/job.ts";
import { api } from "../engines/server.ts";

const POLL_MS = 3000;

/** Job history; polls while any job is queued or running. */
export function useJobs() {
  const [jobs, setJobs] = useState<JobSummary[]>([]);
  const refresh = useCallback(() => {
    api.list().then(setJobs, () => undefined); // The next poll or action retries.
  }, []);

  useEffect(refresh, [refresh]);

  const busy = jobs.some((job) => job.status === "queued" || job.status === "running");
  useEffect(() => {
    if (!busy) return;
    const timer = setInterval(refresh, POLL_MS);
    return () => clearInterval(timer);
  }, [busy, refresh]);

  return { jobs, refresh };
}
