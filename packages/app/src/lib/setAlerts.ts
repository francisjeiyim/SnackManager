/**
 * Paid-time window for the floor alerts.
 *
 * A guest's paid time is the first set plus every validated extension block
 * (a full set or a half-set). Past that mark the guest is "overdue" until an
 * operator validates another block or the ticket is closed.
 */
export interface PaidWindow {
  /** Minutes-mark the paid time runs out. */
  paidUntil: number;
  /**
   * Whole minutes sat past the paid time, for display (0 while still within it,
   * and also 0 for the first < 1 min after the limit — use {@link reached} for
   * the alert state, not this).
   */
  overdueMinutes: number;
  /** The paid time has been reached or exceeded — alarm on, seat red. */
  reached: boolean;
}

export function paidWindow(
  mins: number,
  setMinutes: number,
  extensionMinutes: number,
): PaidWindow {
  const paidUntil = Math.max(1, setMinutes) + Math.max(0, extensionMinutes);
  return {
    paidUntil,
    overdueMinutes: Math.max(0, Math.floor(mins - paidUntil)),
    reached: mins >= paidUntil,
  };
}
