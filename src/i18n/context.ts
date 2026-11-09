import { createContext, useContext } from "react";
import type { MessageKey } from "./en.ts";

export type Locale = "en" | "fr";
export type Translate = (key: MessageKey, vars?: Record<string, string | number>) => string;

export interface I18n {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: Translate;
}

export const I18nContext = createContext<I18n | null>(null);

export function useI18n(): I18n {
  const value = useContext(I18nContext);
  if (!value) throw new Error("useI18n outside I18nProvider");
  return value;
}
