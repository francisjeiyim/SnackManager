/** Local `YYYY-MM-DD` service day (mirrors the server helper). */
export function serviceDayOf(now: Date, cutoverHour: number): string {
  const shifted = new Date(now.getTime() - cutoverHour * 3_600_000);
  const y = shifted.getFullYear();
  const m = String(shifted.getMonth() + 1).padStart(2, "0");
  const d = String(shifted.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}
