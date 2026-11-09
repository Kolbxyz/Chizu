import { useCallback, useEffect, useState } from "react";
import { parseRef, type JobRef } from "../engines/types.ts";

const PREFIX = "#/job/";

/** Selected job, kept in the URL hash ("#/job/<engine>:<id>") so a reload keeps it. */
function read(): JobRef | undefined {
  if (!location.hash.startsWith(PREFIX)) return undefined;
  const value = decodeURIComponent(location.hash.slice(PREFIX.length));
  // Links from before the API engine carry a bare Claude Code job id.
  const parsed = parseRef(value) ?? parseRef(`cc:${value}`);
  return parsed ? `${parsed.engine}:${parsed.id}` : undefined;
}

export function useSelectedJob() {
  const [ref, setRef] = useState<JobRef | undefined>(read);

  useEffect(() => {
    const onChange = () => setRef(read());
    window.addEventListener("hashchange", onChange);
    return () => window.removeEventListener("hashchange", onChange);
  }, []);

  const select = useCallback((next: JobRef | undefined) => {
    location.hash = next ? `${PREFIX}${next}` : "";
    setRef(next);
  }, []);

  return [ref, select] as const;
}
