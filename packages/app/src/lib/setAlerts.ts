/**
 * Set / half-set boundaries for the floor alerts.
 *
 * With a 90-min set the boundaries are 90, 135, 180, 225… (the first set, then
 * every half-set). `index` counts them from 0 (0 = end of the first set).
 */
export interface SetWindow {
  /** Minutes-mark of the last boundary already passed (0 if none yet). */
  lastAt: number;
  /** Index of that boundary, or -1 before the first set ends. */
  lastIndex: number;
  /** Minutes-mark of the next boundary. */
  nextAt: number;
  /** Index of the next boundary. */
  nextIndex: number;
}

export function currentSetWindow(mins: number, setMinutes: number): SetWindow {
  const set = Math.max(1, setMinutes);
  const half = set / 2;
  if (mins < set) {
    return { lastAt: 0, lastIndex: -1, nextAt: set, nextIndex: 0 };
  }
  const k = Math.floor((mins - set) / half);
  const lastAt = set + k * half;
  return { lastAt, lastIndex: k, nextAt: lastAt + half, nextIndex: k + 1 };
}
