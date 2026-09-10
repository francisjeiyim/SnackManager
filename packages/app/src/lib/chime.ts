/**
 * Tiny synthesized alert tones — no audio file, no dependency.
 *
 * Browsers block audio until a user gesture. `unlockAudio()` (called from any
 * tap via `useAudioUnlock`, from the login button, and from the Settings test
 * button) resumes the context and asks iOS to ignore the silent switch.
 */

let ctx: AudioContext | null = null;
let resumeInstalled = false;

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

/** Keep the context alive across iOS tab suspensions. Installed once. */
function installResume(): void {
  if (resumeInstalled || typeof document === "undefined") return;
  resumeInstalled = true;
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible" && ctx && ctx.state === "suspended") {
      void ctx.resume().catch(() => undefined);
    }
  });
}

/** Call from a click / keypress handler to permit audio for the session. */
export async function unlockAudio(): Promise<void> {
  const c = getCtx();
  if (!c) return;
  installResume();
  // iOS 16.4+ — play through the "playback" session so the mute switch is ignored
  try {
    const s = (navigator as unknown as { audioSession?: { type: string } }).audioSession;
    if (s) s.type = "playback";
  } catch {
    /* not supported */
  }
  if (c.state === "suspended") {
    try {
      await c.resume();
    } catch {
      /* ignore */
    }
  }
}

/** True once the context is running and chimes will actually sound. */
export function audioReady(): boolean {
  return ctx?.state === "running";
}

export type ChimeKind = "soft" | "hard";

/**
 * `hard` — two clear ascending notes at / past the boundary.
 * `soft` — one gentle low note for the pre-alert window.
 */
export function playChime(kind: ChimeKind): void {
  const c = getCtx();
  if (!c || c.state !== "running") return;

  const now = c.currentTime;
  const notes: Array<[freq: number, start: number, dur: number, peak: number]> =
    kind === "hard"
      ? [
          [660, 0, 0.16, 0.25],
          [990, 0.17, 0.28, 0.25],
        ]
      : [[440, 0, 0.35, 0.1]];

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
