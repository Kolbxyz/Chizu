import { Moon, Sun } from "lucide-react";
import { useI18n } from "../../i18n/context.ts";
import "./HeaderTools.css";

interface Props {
  theme: "light" | "dark";
  onToggleTheme: () => void;
}

/** Theme and language switches, shown on the header's eyebrow line. */
export function HeaderTools({ theme, onToggleTheme }: Props) {
  const { t, locale, setLocale } = useI18n();
  const next = locale === "fr" ? "en" : "fr";
  return (
    <div className="header-tools">
      <button
        type="button"
        className="header-tools__button"
        onClick={onToggleTheme}
        aria-label={t("theme.toggle")}
        title={t("theme.toggle")}
      >
        {theme === "dark" ? <Moon size={16} aria-hidden /> : <Sun size={16} aria-hidden />}
      </button>
      <button
        type="button"
        className="header-tools__button header-tools__lang"
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
