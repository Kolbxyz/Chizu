import { useEffect, useRef, useState } from "react";
import type { Job, JobEvent } from "../../shared/job.ts";
import { api } from "../engines/server.ts";
import { applyEvent } from "../lib/derive.ts";

/** Live job state over Server-Sent Events: a snapshot, then every new event. */
export function useJobStream(id: string | undefined, onEvent?: (event: JobEvent) => void) {
  // Keyed by id, so a stale job is never shown after the selection changes.
  const [state, setState] = useState<{ id: string; job: Job } | undefined>();
  // A ref, so a new callback identity does not reopen the stream.
  const onEventRef = useRef(onEvent);
  useEffect(() => {
    onEventRef.current = onEvent;
  });

  useEffect(() => {
    if (!id) return;
    const source = new EventSource(api.eventsUrl(id));
    source.addEventListener("snapshot", (message) =>
      setState({ id, job: JSON.parse(message.data) as Job }),
    );
    source.addEventListener("event", (message) => {
      const event = JSON.parse(message.data) as JobEvent;
      setState((current) =>
        current?.id === id ? { id, job: applyEvent(current.job, event) } : current,
      );
      onEventRef.current?.(event);
    });
    return () => source.close();
  }, [id]);

  return state && state.id === id ? state.job : undefined;
}
