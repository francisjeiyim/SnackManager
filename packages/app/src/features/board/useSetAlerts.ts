import { useEffect, useRef } from "react";
import type { Guest } from "@snackmanager/shared";
import { elapsedMs } from "@snackmanager/shared";
import { playChime } from "../../lib/chime";
import { currentSetWindow } from "../../lib/setAlerts";

interface Options {
  setMinutes: number;
  graceMinutes: number;
  leadMinutes: number;
  /** Seconds between repeats while the alarm stays active (0 = once per episode). */
  repeatSeconds: number;
  enabled: boolean;
}

const consumedHalfSets = (mins: number, setMinutes: number, grace: number): number => {
  if (mins <= grace || mins <= setMinutes) return 0;
  return Math.ceil((mins - setMinutes) / (setMinutes / 2));
};

/**
 * Rings the end-of-set alarm and keeps repeating it while a seat is in the
 * pre-alert window or has an extension half-set the operator has not validated
 * — until they validate it or the ticket is closed. All clients share the clock
 * and math, so the chimes land together.
 */
export function useSetAlerts(
  guestsBySeat: Map<string, Guest[]>,
  now: Date,
  { setMinutes, graceMinutes, leadMinutes, repeatSeconds, enabled }: Options,
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
      const win = currentSetWindow(mins, setMinutes);
      const consumed = consumedHalfSets(mins, setMinutes, graceMinutes);
      const pending = Math.max(0, consumed - (primary.validatedHalfSets ?? 0));
      const inLead = leadMinutes > 0 && win.nextAt - mins <= leadMinutes && win.nextAt - mins >= 0;

      const active = pending > 0 || inLead;
      if (!active) {
        lastPlayed.current.delete(seatId);
        continue;
      }
      const prev = lastPlayed.current.get(seatId);
      if (prev == null || nowMs - prev >= repeatMs) {
        playChime(pending > 0 ? "hard" : "soft");
        lastPlayed.current.set(seatId, nowMs);
      }
    }

    for (const seatId of [...lastPlayed.current.keys()]) {
      if (!live.has(seatId)) lastPlayed.current.delete(seatId);
    }
  }, [guestsBySeat, now, setMinutes, graceMinutes, leadMinutes, repeatSeconds, enabled]);
}
