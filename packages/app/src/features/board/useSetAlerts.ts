import { useEffect, useRef } from "react";
import type { Guest } from "@snackmanager/shared";
import { elapsedMs } from "@snackmanager/shared";
import { playChime, type ChimeKind } from "../../lib/chime";
import { currentSetWindow } from "../../lib/setAlerts";

interface Options {
  setMinutes: number;
  leadMinutes: number;
  enabled: boolean;
}

/**
 * Rings a chime as each occupied seat approaches (`soft`) then crosses (`hard`)
 * a set / half-set boundary. De-duplicated per seat + boundary; only fires while
 * the tab is visible. All clients share the same clock and math, so the chimes
 * land within a second of each other.
 */
export function useSetAlerts(
  guestsBySeat: Map<string, Guest[]>,
  now: Date,
  { setMinutes, leadMinutes, enabled }: Options,
): void {
  // seatId -> { soft: boundaryIndex last soft-alerted, hard: last hard-alerted }
  const fired = useRef(new Map<string, { soft: number; hard: number }>());

  useEffect(() => {
    if (!enabled || typeof document === "undefined" || document.visibilityState !== "visible") {
      return;
    }
    const live = new Set<string>();

    for (const [seatId, guests] of guestsBySeat) {
      if (guests.length === 0) continue;
      live.add(seatId);
      const earliest = Math.min(...guests.map((g) => Date.parse(g.arrivalAt)));
      const mins = elapsedMs(new Date(earliest), now) / 60_000;
      const win = currentSetWindow(mins, setMinutes);
      const seen = fired.current.get(seatId) ?? { soft: -1, hard: -1 };

      let sound: ChimeKind | null = null;
      if (win.lastIndex >= 0 && win.lastIndex > seen.hard && mins - win.lastAt < 2) {
        seen.hard = win.lastIndex;
        // don't also soft-alert for a boundary we've already passed
        seen.soft = Math.max(seen.soft, win.lastIndex);
        sound = "hard";
      } else if (
        leadMinutes > 0 &&
        win.nextIndex > seen.soft &&
        win.nextAt - mins <= leadMinutes
      ) {
        seen.soft = win.nextIndex;
        sound = "soft";
      }
      fired.current.set(seatId, seen);
      if (sound) playChime(sound);
    }

    // forget seats that are now free so a re-seat starts clean
    for (const seatId of [...fired.current.keys()]) {
      if (!live.has(seatId)) fired.current.delete(seatId);
    }
  }, [guestsBySeat, now, setMinutes, leadMinutes, enabled]);
}
