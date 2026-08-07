/**
 * Shared time formatting.
 *
 * D1/SQLite stores timestamps via CURRENT_TIMESTAMP as UTC strings WITHOUT a
 * timezone marker (e.g. "2026-08-07 04:30:00"). `new Date()` would parse that
 * as LOCAL time, shifting relative times by the user's UTC offset (e.g. 5.5h
 * for IST). parseDbDate normalizes such strings to UTC before parsing.
 */
export const parseDbDate = (value: string | number | Date): Date => {
  if (typeof value === "number" || value instanceof Date) return new Date(value);
  const hasTzMarker = /(Z|[+-]\d{2}:?\d{2})$/.test(value);
  const normalized = hasTzMarker ? value : `${value.replace(" ", "T")}Z`;
  return new Date(normalized);
};

/** "Just now" / "Xm ago" / "Xh ago" / "Xd ago" — minute-granular. */
export const formatTimeAgo = (value?: string | number | Date | null): string => {
  if (value === undefined || value === null) return "";
  const d = parseDbDate(value);
  if (isNaN(d.getTime())) return "";

  const delta = Date.now() - d.getTime();
  if (delta < 0) return "Just now";
  const seconds = Math.floor(delta / 1000);
  if (seconds < 60) return "Just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
};

/** Short calendar date, e.g. "Aug 7". */
export const formatShortDate = (value?: string | number | Date | null): string => {
  if (value === undefined || value === null) return "Unknown date";
  const d = parseDbDate(value);
  if (isNaN(d.getTime())) return "Unknown date";
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
};
