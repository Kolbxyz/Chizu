import { useEffect, useRef, useState } from "react";
import type { Job, JobEvent } from "../../shared/job.ts";
import { parseRef, type JobRef } from "../engines/types.ts";
import { applyEvent } from "../lib/derive.ts";
import { useSettings } from "../settings/context.ts";

/** Live job state from its engine: a snapshot, then every new event. */
export function useJobStream(ref: JobRef | undefined, onEvent?: (event: JobEvent) => void) {
  const { engines } = useSettings();
  // Keyed by ref, so a stale job is never shown after the selection changes.
  const [state, setState] = useState<{ ref: JobRef; job: Job } | undefined>();
  // A ref, so a new callback identity does not reopen the stream.
  const onEventRef = useRef(onEvent);
  useEffect(() => {
    onEventRef.current = onEvent;
  });

  useEffect(() => {
    const target = ref ? parseRef(ref) : undefined;
    const engine = target ? engines[target.engine] : undefined;
    if (!ref || !target || !engine) return;
    return engine.watch(
      target.id,
      (job) => setState({ ref, job }),
      (event) => {
        setState((current) =>
          current?.ref === ref ? { ref, job: applyEvent(current.job, event) } : current,
        );
        onEventRef.current?.(event);
      },
    );
  }, [ref, engines]);

  return state && state.ref === ref ? state.job : undefined;
}
