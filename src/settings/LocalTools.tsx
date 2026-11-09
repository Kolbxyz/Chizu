import { useI18n } from "../i18n/context.ts";
import { useSettings } from "./context.ts";

/** Code execution status and the browser switch of the Claude Code engine (styled by SettingsDialog.css). */
export function LocalTools() {
  const { t } = useI18n();
  const { local, capabilities, browser, setBrowser } = useSettings();
  if (local !== "ready") return null;
  return (
    <fieldset className="settings__group">
      <legend>{t("settings.local")}</legend>
      <p className="settings__hint">
        {t(capabilities.code ? "settings.code.on" : "settings.code.off")}
      </p>
      <label className="settings__check">
        <input
          type="checkbox"
          checked={browser && capabilities.browser}
          disabled={!capabilities.browser}
          onChange={(e) => setBrowser(e.target.checked)}
        />
        <span>{t("settings.browser")}</span>
      </label>
      {!capabilities.browser && <p className="settings__hint">{t("settings.browser.missing")}</p>}
    </fieldset>
  );
}
