import { useState, type ReactNode } from "react";
import { Eye, EyeOff } from "lucide-react";
import { useI18n } from "../i18n/context.ts";

interface Props {
  label: string;
  value: string;
  placeholder: string;
  onChange: (value: string) => void;
  remember: boolean;
  onRemember: (remember: boolean) => void;
  /** Privacy note and link shown under the field. */
  hint: ReactNode;
}

/** A credential input with a reveal toggle and an opt-in "remember" box (styled by SettingsDialog.css). */
export function SecretField({
  label,
  value,
  placeholder,
  onChange,
  remember,
  onRemember,
  hint,
}: Props) {
  const { t } = useI18n();
  const [reveal, setReveal] = useState(false);
  return (
    <>
      <label className="settings__field">
        <span>{label}</span>
        <span className="settings__key">
          <input
            type={reveal ? "text" : "password"}
            value={value}
            autoComplete="off"
            spellCheck={false}
            placeholder={placeholder}
            onChange={(e) => onChange(e.target.value)}
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
        <input type="checkbox" checked={remember} onChange={(e) => onRemember(e.target.checked)} />
        <span>{t("settings.remember")}</span>
      </label>
      <p className="settings__hint">{hint}</p>
    </>
  );
}
