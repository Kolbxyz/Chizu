import { useCallback, useEffect, useState } from "react";

const PREFIX = "#/job/";

/** Selected job id, kept in the URL hash so a reload keeps the selection. */
const read = () =>
  location.hash.startsWith(PREFIX) ? location.hash.slice(PREFIX.length) : undefined;

export function useSelectedJob() {
  const [id, setId] = useState<string | undefined>(read);

  useEffect(() => {
    const onChange = () => setId(read());
    window.addEventListener("hashchange", onChange);
    return () => window.removeEventListener("hashchange", onChange);
  }, []);

  const select = useCallback((next: string | undefined) => {
    location.hash = next ? `${PREFIX}${next}` : "";
    setId(next);
  }, []);

  return [id, select] as const;
}
