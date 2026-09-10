/**
 * Synthesized alert sounds — no audio file, no dependency.
 *
 * These are deliberately *loud, ringing* alerts (a warbling telephone / bell,
 * not a soft beep) because on tablets the speaker output is quiet and a short
 * sine "bip" gets missed on a busy floor. The signal is pushed to the full
 * digital headroom through a saturation curve + compressor so it is as loud as
 * the device volume allows.
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

// --- loudness chain: saturation -> compressor -> master -> speakers ---------

let chainInput: AudioNode | null = null;

/** `y = tanh(k·x)` normalized to ±1 — adds harmonics (perceived loudness) and
 * turns hard clipping into a smoother saturation. */
function softClipCurve(k: number): Float32Array {
  const n = 1024;
  const curve = new Float32Array(n);
  const norm = Math.tanh(k);
  for (let i = 0; i < n; i++) {
    const x = (i / (n - 1)) * 2 - 1;
    curve[i] = Math.tanh(k * x) / norm;
  }
  return curve;
}

function getChainInput(c: AudioContext): AudioNode {
  if (chainInput) return chainInput;

  const shaper = c.createWaveShaper();
  // cast: lib.dom's curve setter is typed `Float32Array<ArrayBuffer>` in newer TS
  shaper.curve = softClipCurve(2.6) as WaveShaperNode["curve"];
  shaper.oversample = "2x";

  const comp = c.createDynamicsCompressor();
  comp.threshold.value = -22;
  comp.knee.value = 12;
  comp.ratio.value = 12;
  comp.attack.value = 0.003;
  comp.release.value = 0.12;

  const master = c.createGain();
  master.gain.value = 1.5; // make-up + push into a gentle clip = maximum loudness

  shaper.connect(comp).connect(master).connect(c.destination);
  chainInput = shaper;
  return chainInput;
}

interface RingSpec {
  /** The two frequencies that warble together, like a phone ringtone. */
  tones: [number, number];
  /** Number of on/off "brr" pulses in one burst. */
  pulses: number;
  onMs: number;
  offMs: number;
  /** Target peak (0..1) before the saturation/compressor stage. */
  level: number;
  /** Add an urgent rising/falling siren layer under the ring. */
  siren: boolean;
}

const SPECS: Record<ChimeKind, RingSpec> = {
  // paid time reached / overdue — insistent, urgent, keeps ringing every repeat
  hard: { tones: [640, 880], pulses: 9, onMs: 180, offMs: 95, level: 0.98, siren: true },
  // pre-alert — a calmer double ring, still a bell, not a beep
  soft: { tones: [440, 554], pulses: 3, onMs: 300, offMs: 190, level: 0.68, siren: false },
};

/**
 * `hard` — a loud warbling telephone/bell ring with a siren underneath, for
 * when the paid time is reached or exceeded.
 * `soft` — a gentler ring for the pre-alert window.
 * Repeats are driven by the caller (`soundRepeatSeconds`), so it behaves like
 * a phone that keeps ringing until someone answers.
 */
export function playChime(kind: ChimeKind): void {
  const c = getCtx();
  if (!c) return;
  if (c.state === "suspended") void c.resume().catch(() => undefined);
  if (c.state !== "running") return;

  const spec = SPECS[kind];
  const t0 = c.currentTime;
  const stepS = (spec.onMs + spec.offMs) / 1000;
  const onS = spec.onMs / 1000;
  const burstS = spec.pulses * stepS;
  const input = getChainInput(c);

  // tremolo — the "electric bell" shimmer on the ring
  const tremolo = c.createGain();
  tremolo.gain.value = 0.78;
  tremolo.connect(input);
  const lfo = c.createOscillator();
  lfo.type = "sine";
  lfo.frequency.value = kind === "hard" ? 17 : 11;
  const lfoDepth = c.createGain();
  lfoDepth.gain.value = 0.32;
  lfo.connect(lfoDepth).connect(tremolo.gain);
  lfo.start(t0);
  lfo.stop(t0 + burstS + 0.1);

  const started: OscillatorNode[] = [lfo];

  for (let i = 0; i < spec.pulses; i++) {
    const start = t0 + i * stepS;
    const env = c.createGain();
    env.gain.setValueAtTime(0.0001, start);
    env.gain.exponentialRampToValueAtTime(spec.level, start + 0.006);
    env.gain.setValueAtTime(spec.level, start + onS - 0.03);
    env.gain.exponentialRampToValueAtTime(0.0001, start + onS);
    env.connect(tremolo);

    // the two warble tones (square = far louder than sine) + a body tone an octave down
    const voices: Array<[OscillatorType, number, number]> = [
      ["square", spec.tones[0], 1],
      ["square", spec.tones[1], 0.9],
      ["sawtooth", spec.tones[0] / 2, 0.5],
    ];
    for (const [type, freq, rel] of voices) {
      const osc = c.createOscillator();
      osc.type = type;
      osc.frequency.value = freq;
      const vg = c.createGain();
      vg.gain.value = rel * 0.6;
      osc.connect(vg).connect(env);
      osc.start(start);
      osc.stop(start + onS + 0.03);
      started.push(osc);
    }
  }

  if (spec.siren) {
    const siren = c.createOscillator();
    siren.type = "sawtooth";
    const sg = c.createGain();
    sg.gain.value = spec.level * 0.45;
    // sweep up and down a few times across the burst
    siren.frequency.setValueAtTime(520, t0);
    const sweeps = 4;
    for (let s = 0; s < sweeps; s++) {
      const mid = t0 + (burstS * (s + 0.5)) / sweeps;
      const end = t0 + (burstS * (s + 1)) / sweeps;
      siren.frequency.linearRampToValueAtTime(1180, mid);
      siren.frequency.linearRampToValueAtTime(520, end);
    }
    siren.connect(sg).connect(input);
    siren.start(t0);
    siren.stop(t0 + burstS + 0.05);
    started.push(siren);
  }

  // safety: make sure nothing lingers
  const stopAll = t0 + burstS + 0.2;
  for (const o of started) {
    try {
      o.stop(stopAll);
    } catch {
      /* already stopped */
    }
  }
}
