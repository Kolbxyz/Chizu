import { Moon, Settings2, Sun } from "lucide-react";
import { useI18n } from "../../i18n/context.ts";
import "./Preferences.css";

interface Props {
  theme: "light" | "dark";
  onToggleTheme: () => void;
  onOpenSettings: () => void;
}

/** Settings, theme and language switches, at the foot of the sidebar. */
export function Preferences({ theme, onToggleTheme, onOpenSettings }: Props) {
  const { t, locale, setLocale } = useI18n();
  const next = locale === "fr" ? "en" : "fr";
  return (
    <div className="preferences">
      <button type="button" className="preferences__settings" onClick={onOpenSettings}>
        <Settings2 size={16} aria-hidden />
        <span>{t("settings.open")}</span>
      </button>
      <button
        type="button"
        className="preferences__button"
        onClick={onToggleTheme}
        aria-label={t("theme.toggle")}
        title={t("theme.toggle")}
      >
        {theme === "dark" ? <Moon size={16} aria-hidden /> : <Sun size={16} aria-hidden />}
      </button>
      <button
        type="button"
        className="preferences__button preferences__lang"
        onClick={() => setLocale(next)}
        aria-label={t("lang.toggle")}
        title={t("lang.toggle")}
        lang={next}
      >
        {next.toUpperCase()}
      </button>
    </div>
  );
}
