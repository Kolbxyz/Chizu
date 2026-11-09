// Per-browser preferences (theme, language, map layer). Storage can be
// unavailable in private windows; defaults apply then.
type Key =
  | "theme"
  | "locale"
  | "layer"
  | "engine"
  | "model"
  | "apiKey"
  | "browser"
  /** Removed feature; a remembered token is cleared at startup. */
  | "mapillaryToken";

export function readSetting(key: Key): string | null {
  try {
    return localStorage.getItem(`chizu.${key}`);
  } catch {
    return null;
  }
}

export function writeSetting(key: Key, value: string): void {
  try {
    localStorage.setItem(`chizu.${key}`, value);
  } catch {
    // Preference is kept for this session only.
  }
}

export function clearSetting(key: Key): void {
  try {
    localStorage.removeItem(`chizu.${key}`);
  } catch {
    // Nothing stored.
  }
}
