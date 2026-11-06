/**
 * Dates as the design shows them: "5 Nov 2026" (long), "4 Nov" (short,
 * current year) and news times ("09:42", "Yesterday", "3 Nov").
 * Times use the publication's time zone (default Europe/London).
 */
const fmt = (opts: Intl.DateTimeFormatOptions, timeZone: string) => new Intl.DateTimeFormat("en-GB", { ...opts, timeZone });

function dayKey(d: Date, timeZone: string) {
  return fmt({ year: "numeric", month: "2-digit", day: "2-digit" }, timeZone).format(d);
}

export function formatDate(d: Date, timeZone = "Europe/London"): string {
  return fmt({ day: "numeric", month: "short", year: "numeric" }, timeZone).format(d);
}

export function formatShortDate(d: Date, timeZone = "Europe/London", now = new Date()): string {
  const sameYear = fmt({ year: "numeric" }, timeZone).format(d) === fmt({ year: "numeric" }, timeZone).format(now);
  return fmt(sameYear ? { day: "numeric", month: "short" } : { day: "numeric", month: "short", year: "numeric" }, timeZone).format(d);
}

export function formatNewsTime(d: Date, timeZone = "Europe/London", now = new Date()): string {
  if (dayKey(d, timeZone) === dayKey(now, timeZone)) {
    return fmt({ hour: "2-digit", minute: "2-digit", hour12: false }, timeZone).format(d);
  }
  if (dayKey(d, timeZone) === dayKey(new Date(now.getTime() - 86_400_000), timeZone)) return "Yesterday";
  return formatShortDate(d, timeZone, now);
}

export function formatDuration(seconds: number | null | undefined): string {
  if (!seconds || seconds < 0) return "";
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  const mm = h ? String(m).padStart(2, "0") : String(m);
  return `${h ? `${h}:` : ""}${mm}:${String(s).padStart(2, "0")}`;
}

export function formatLongDateline(d: Date, timeZone = "Europe/London"): string {
  return fmt({ weekday: "long", day: "numeric", month: "long", year: "numeric" }, timeZone).format(d);
}

/** "YYYY-MM-DD" for a moment in a time zone; stats are bucketed by the publication's day. */
export function isoDay(d: Date, timeZone = "Europe/London"): string {
  return new Intl.DateTimeFormat("en-CA", { year: "numeric", month: "2-digit", day: "2-digit", timeZone }).format(d);
}

/** Adds whole days to a "YYYY-MM-DD" date. */
export function shiftDay(day: string, days: number): string {
  return new Date(Date.parse(`${day}T00:00:00Z`) + days * 86_400_000).toISOString().slice(0, 10);
}
