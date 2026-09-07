/**
 * The "service day" a moment belongs to, as a local `YYYY-MM-DD` string.
 * Anything before `cutoverHour` (local) counts as the previous day, so a late
 * night still bills under one date.
 */
export function serviceDayOf(now: Date, cutoverHour: number): string {
  const shifted = new Date(now.getTime() - cutoverHour * 3_600_000);
  const y = shifted.getFullYear();
  const m = String(shifted.getMonth() + 1).padStart(2, "0");
  const d = String(shifted.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}
