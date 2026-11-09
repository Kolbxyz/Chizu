import { useCallback, useState } from "react";
import { readSetting, writeSetting } from "../lib/settings.ts";

type Theme = "light" | "dark";

function current(): Theme {
  const forced = document.documentElement.dataset.theme;
  if (forced === "light" || forced === "dark") return forced;
  return matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

/** Light/dark toggle; the saved choice is applied before paint by public/theme.js. */
export function useTheme() {
  const [theme, setTheme] = useState<Theme>(
    () => (readSetting("theme") as Theme | null) ?? current(),
  );
  const toggle = useCallback(() => {
    const next: Theme = current() === "dark" ? "light" : "dark";
    document.documentElement.dataset.theme = next;
    writeSetting("theme", next);
    setTheme(next);
  }, []);
  return { theme, toggle };
}
