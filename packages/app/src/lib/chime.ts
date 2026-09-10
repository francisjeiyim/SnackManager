/**
 * Tiny synthesized alert tones — no audio file, no dependency.
 * `unlockAudio()` must run inside a user gesture once per page (browsers block
 * audio otherwise); after that `playChime()` works from anywhere.
 */

let ctx: AudioContext | null = null;

function getCtx(): AudioContext | null {
  if (typeof window === "undefined") return null;
  const Ctor: typeof AudioContext | undefined =
    window.AudioContext ??
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctor) return null;
  if (!ctx) {
    try {
      ctx = new Ctor();
    } catch {
      return null;
    }
  }
  return ctx;
}

/** Call from a click / keypress handler to permit audio for the session. */
export async function unlockAudio(): Promise<void> {
  const c = getCtx();
  if (c && c.state === "suspended") {
    try {
      await c.resume();
    } catch {
      /* ignore */
    }
  }
}

export type ChimeKind = "soft" | "hard";

/**
 * `hard` — two clear ascending notes at the boundary.
 * `soft` — one gentle low note for the pre-alert window.
 */
export function playChime(kind: ChimeKind): void {
  const c = getCtx();
  if (!c || c.state !== "running") return;

  const now = c.currentTime;
  const notes: Array<[freq: number, start: number, dur: number, peak: number]> =
    kind === "hard"
      ? [
          [660, 0, 0.16, 0.22],
          [990, 0.17, 0.28, 0.22],
        ]
      : [[440, 0, 0.35, 0.09]];

  for (const [freq, start, dur, peak] of notes) {
    const osc = c.createOscillator();
    const gain = c.createGain();
    osc.type = "sine";
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0.0001, now + start);
    gain.gain.exponentialRampToValueAtTime(peak, now + start + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + start + dur);
    osc.connect(gain).connect(c.destination);
    osc.start(now + start);
    osc.stop(now + start + dur + 0.02);
  }
}
