import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { I18nContext, type Locale, type Translate } from "./context.ts";
import { en } from "./en.ts";
import { fr } from "./fr.ts";
import { readSetting, writeSetting } from "../lib/settings.ts";

const MESSAGES = { en, fr } as const;

function initialLocale(): Locale {
  const saved = readSetting("locale");
  if (saved === "en" || saved === "fr") return saved;
  return navigator.language.toLowerCase().startsWith("fr") ? "fr" : "en";
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(initialLocale);

  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);

  const setLocale = useCallback((next: Locale) => {
    setLocaleState(next);
    writeSetting("locale", next);
  }, []);

  const t = useCallback<Translate>(
    (key, vars) =>
      MESSAGES[locale][key].replace(/\{(\w+)\}/g, (match, name: string) =>
        vars && name in vars ? String(vars[name]) : match,
      ),
    [locale],
  );

  const value = useMemo(() => ({ locale, setLocale, t }), [locale, setLocale, t]);
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}
