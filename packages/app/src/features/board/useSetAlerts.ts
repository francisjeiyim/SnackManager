import { useEffect, useRef } from "react";
import type { Guest } from "@snackmanager/shared";
import { elapsedMs } from "@snackmanager/shared";
import { playChime } from "../../lib/chime";
import { paidWindow } from "../../lib/setAlerts";

interface Options {
  setMinutes: number;
  graceMinutes: number;
  leadMinutes: number;
  /** Seconds between repeats while the alarm stays active (0 = once per episode). */
  repeatSeconds: number;
  enabled: boolean;
}

/**
 * Rings the end-of-set alarm and keeps repeating it while a seat is in the
 * pre-alert window or has run past its paid time (first set + validated
 * extensions) — until an operator validates another block or the ticket is
 * closed. All clients share the clock and math, so the chimes land together.
 */
export function useSetAlerts(
  guestsBySeat: Map<string, Guest[]>,
  now: Date,
  { setMinutes, leadMinutes, repeatSeconds, enabled }: Options,
): void {
  const lastPlayed = useRef(new Map<string, number>());

  useEffect(() => {
    if (!enabled || typeof document === "undefined" || document.visibilityState !== "visible") {
      return;
    }
    const nowMs = now.getTime();
    const repeatMs = repeatSeconds > 0 ? repeatSeconds * 1000 : Number.POSITIVE_INFINITY;
    const live = new Set<string>();

    for (const [seatId, guests] of guestsBySeat) {
      if (guests.length === 0) continue;
      live.add(seatId);
      const primary = guests.reduce((a, b) =>
        Date.parse(a.arrivalAt) <= Date.parse(b.arrivalAt) ? a : b,
      );
      const mins = elapsedMs(new Date(primary.arrivalAt), now) / 60_000;
      const setMin = primary.setMinutesSnapshot || setMinutes;
      const { paidUntil, reached } = paidWindow(mins, setMin, primary.extensionMinutes ?? 0);
      const inLead = !reached && leadMinutes > 0 && paidUntil - mins <= leadMinutes;

      // Once the paid time is reached the alarm keeps ringing until the guest is
      // extended (paidUntil moves out) or the ticket is closed.
      const active = reached || inLead;
      if (!active) {
        lastPlayed.current.delete(seatId);
        continue;
      }
      const prev = lastPlayed.current.get(seatId);
      if (prev == null || nowMs - prev >= repeatMs) {
        playChime(reached ? "hard" : "soft");
        lastPlayed.current.set(seatId, nowMs);
      }
    }

    for (const seatId of [...lastPlayed.current.keys()]) {
      if (!live.has(seatId)) lastPlayed.current.delete(seatId);
    }
  }, [guestsBySeat, now, setMinutes, leadMinutes, repeatSeconds, enabled]);
}
