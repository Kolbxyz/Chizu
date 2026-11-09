// Locale-aware formatting helpers (Intl only).

export function formatDistance(metres: number, locale: string): string {
  const km = metres >= 1000;
  return new Intl.NumberFormat(locale, {
    style: "unit",
    unit: km ? "kilometer" : "meter",
    maximumFractionDigits: km && metres < 10_000 ? 1 : 0,
  }).format(km ? metres / 1000 : metres);
}

export const formatPercent = (value: number, locale: string) =>
  new Intl.NumberFormat(locale, { style: "percent", maximumFractionDigits: 0 }).format(value);

export const formatCost = (usd: number, locale: string) =>
  new Intl.NumberFormat(locale, {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  }).format(usd);

export function formatDuration(ms: number, locale: string): string {
  const minutes = Math.floor(ms / 60_000);
  const seconds = Math.round((ms % 60_000) / 1000);
  const unit = (value: number, name: "minute" | "second") =>
    new Intl.NumberFormat(locale, { style: "unit", unit: name, unitDisplay: "narrow" }).format(
      value,
    );
  return minutes > 0
    ? `${unit(minutes, "minute")} ${unit(seconds, "second")}`
    : unit(seconds, "second");
}

export const formatCoords = (lat: number, lng: number) => `${lat.toFixed(5)}, ${lng.toFixed(5)}`;

export const formatDate = (value: string | number, locale: string) =>
  new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeStyle: "short" }).format(
    new Date(value),
  );

export function hostOf(url: string): string {
  try {
    return new URL(url).host;
  } catch {
    return url;
  }
}
