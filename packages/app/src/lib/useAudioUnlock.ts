import { useEffect } from "react";
import { unlockAudio } from "./chime";

/**
 * Unlocks alert audio on the very first user interaction anywhere in the app —
 * not just the login button — so an already-signed-in operator (iPad kiosk,
 * phone) still gets the end-of-set chime.
 */
export function useAudioUnlock(): void {
  useEffect(() => {
    const go = (): void => void unlockAudio();
    const opts = { capture: true, once: true } as const;
    window.addEventListener("pointerdown", go, opts);
    window.addEventListener("keydown", go, opts);
    window.addEventListener("touchend", go, opts);
    return () => {
      window.removeEventListener("pointerdown", go, opts);
      window.removeEventListener("keydown", go, opts);
      window.removeEventListener("touchend", go, opts);
    };
  }, []);
}
