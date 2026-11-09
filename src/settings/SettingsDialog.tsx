import { useEffect, useRef, useState } from "react";
import { Eye, EyeOff, X } from "lucide-react";
import { MODELS } from "../engines/browser/pricing.ts";
import type { EngineId } from "../engines/types.ts";
import { useI18n } from "../i18n/context.ts";
import type { MessageKey } from "../i18n/en.ts";
import { useSettings } from "./context.ts";
import "./SettingsDialog.css";

const KEYS_URL = "https://console.anthropic.com/settings/keys";
const LOCAL_REASON: Record<string, MessageKey> = {
  checking: "settings.cc.checking",
  "no-cli": "settings.cc.noCli",
  absent: "settings.cc.absent",
};

interface Props {
  open: boolean;
  /** Shown above the form, e.g. when an analysis needs a key. */
  notice?: string;
  onClose: () => void;
}

export function SettingsDialog({ open, notice, onClose }: Props) {
  const { t } = useI18n();
  const settings = useSettings();
  const dialog = useRef<HTMLDialogElement>(null);
  const [key, setKey] = useState(settings.apiKey);
  const [remember, setRemember] = useState(settings.rememberKey);
  const [reveal, setReveal] = useState(false);

  useEffect(() => {
    if (open) dialog.current?.showModal();
    else dialog.current?.close();
  }, [open]);

  const close = () => {
    settings.setApiKey(key, remember);
    onClose();
  };
  const engines: Array<{ id: EngineId; disabled: boolean; reason?: MessageKey }> = [
    { id: "cc", disabled: settings.local !== "ready", reason: LOCAL_REASON[settings.local] },
    { id: "api", disabled: false },
  ];

  return (
    <dialog
      ref={dialog}
      className="settings"
      aria-labelledby="settings-title"
      onClose={close}
      onCancel={close}
    >
      <header className="settings__head">
        <h2 id="settings-title">{t("settings.title")}</h2>
        <button
          type="button"
          className="settings__close"
          aria-label={t("job.closePhoto")}
          onClick={close}
        >
          <X size={18} aria-hidden />
        </button>
      </header>
      {notice && (
        <p className="settings__notice" role="alert">
          {notice}
        </p>
      )}

      <fieldset className="settings__group">
        <legend>{t("settings.engine")}</legend>
        {engines.map(({ id, disabled, reason }) => (
          <label key={id} className="settings__option" aria-disabled={disabled || undefined}>
            <input
              type="radio"
              name="engine"
              checked={settings.engine === id}
              disabled={disabled}
              onChange={() => settings.setEngine(id)}
            />
            <span>
              <strong>{t(`settings.${id}.name`)}</strong>
              <small>{disabled && reason ? t(reason) : t(`settings.${id}.body`)}</small>
            </span>
          </label>
        ))}
      </fieldset>

      <fieldset className="settings__group">
        <legend>{t("settings.api")}</legend>
        <label className="settings__field">
          <span>{t("settings.key")}</span>
          <span className="settings__key">
            <input
              type={reveal ? "text" : "password"}
              value={key}
              autoComplete="off"
              spellCheck={false}
              placeholder="sk-ant-…"
              onChange={(e) => setKey(e.target.value)}
            />
            <button
              type="button"
              aria-label={t(reveal ? "settings.hideKey" : "settings.showKey")}
              onClick={() => setReveal(!reveal)}
            >
              {reveal ? <EyeOff size={16} aria-hidden /> : <Eye size={16} aria-hidden />}
            </button>
          </span>
        </label>
        <label className="settings__check">
          <input
            type="checkbox"
            checked={remember}
            onChange={(e) => setRemember(e.target.checked)}
          />
          <span>{t("settings.remember")}</span>
        </label>
        <p className="settings__hint">
          {t("settings.keyPrivacy")}{" "}
          <a href={KEYS_URL} target="_blank" rel="noopener noreferrer">
            {t("settings.getKey")}
          </a>
        </p>
        <label className="settings__field">
          <span>{t("settings.model")}</span>
          <select
            value={settings.model}
            onChange={(e) => settings.setModel(e.target.value as (typeof MODELS)[number])}
          >
            {MODELS.map((model) => (
              <option key={model} value={model}>
                {t(`settings.model.${model}`)}
              </option>
            ))}
          </select>
        </label>
      </fieldset>

      <footer className="settings__foot">
        <button type="button" className="settings__done" onClick={close}>
          {t("settings.done")}
        </button>
      </footer>
    </dialog>
  );
}
