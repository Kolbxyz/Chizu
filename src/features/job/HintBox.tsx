import { useState, type FormEvent } from "react";
import { SendHorizontal } from "lucide-react";
import { useI18n } from "../../i18n/context.ts";
import { api } from "../../engines/server.ts";
import "./HintBox.css";

/** Lets the user steer the investigation; works while running and after it ends. */
export function HintBox({ jobId }: { jobId: string }) {
  const { t } = useI18n();
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string>();

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const value = text.trim();
    if (!value) return;
    setSending(true);
    setError(undefined);
    api
      .hint(jobId, value)
      .then(
        () => setText(""),
        (err: Error) => setError(err.message),
      )
      .finally(() => setSending(false));
  };

  return (
    <form className="hint" onSubmit={submit}>
      <label className="visually-hidden" htmlFor="hint-input">
        {t("hint.label")}
      </label>
      <input
        id="hint-input"
        className="hint__input"
        value={text}
        maxLength={2000}
        placeholder={t("hint.placeholder")}
        onChange={(e) => setText(e.target.value)}
      />
      <button
        type="submit"
        className="hint__send"
        disabled={sending || !text.trim()}
        aria-label={t("hint.send")}
      >
        <SendHorizontal size={17} aria-hidden />
      </button>
      {error && (
        <p className="hint__error" role="alert">
          {error}
        </p>
      )}
    </form>
  );
}
