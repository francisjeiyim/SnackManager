/**
 * Alert sounds. Several built-in melodies synthesized with the Web Audio API
 * (no files, works offline), plus an optional custom audio file the operator
 * picks in Settings. Everything is pushed through a saturation + compressor +
 * make-up gain chain so it is as loud as the device volume allows, and (on
 * iOS 16.4+) plays through the "playback" audio session so the mute switch is
 * ignored.
 *
 * Browsers block audio until a user gesture — `unlockAudio()` (from any tap via
 * `useAudioUnlock`, the login button, the Settings test button) resumes it.
 */

import { loadLocalConfig } from "./config";

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

// --- loudness chain: saturation -> compressor -> master -> speakers ---------

let chainInput: AudioNode | null = null;

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
  shaper.curve = softClipCurve(2.6) as WaveShaperNode["curve"];
  shaper.oversample = "2x";
  const comp = c.createDynamicsCompressor();
  comp.threshold.value = -22;
  comp.knee.value = 12;
  comp.ratio.value = 12;
  comp.attack.value = 0.003;
  comp.release.value = 0.12;
  const master = c.createGain();
  master.gain.value = 1.5;
  shaper.connect(comp).connect(master).connect(c.destination);
  chainInput = shaper;
  return chainInput;
}

// --- built-in melodies ----------------------------------------------------

export type ChimeKind = "soft" | "hard";
export type AlarmSound =
  | "ring"
  | "chime"
  | "marimba"
  | "melody"
  | "alert"
  | "siren"
  | "custom";

export const ALARM_SOUNDS: AlarmSound[] = [
  "ring",
  "chime",
  "marimba",
  "melody",
  "alert",
  "siren",
  "custom",
];

const NOTE: Record<string, number> = {
  G3: 196, A3: 220, B3: 246.94,
  C4: 261.63, D4: 293.66, E4: 329.63, F4: 349.23, G4: 392, A4: 440, B4: 493.88,
  C5: 523.25, D5: 587.33, E5: 659.25, F5: 698.46, G5: 783.99, A5: 880, B5: 987.77,
  C6: 1046.5, E6: 1318.5, G6: 1568,
};

interface Note {
  /** seconds from the burst start */
  at: number;
  freq: number;
  dur: number;
  /** 0..1 */
  level: number;
  type?: OscillatorType;
}

/** One "voice": an oscillator with a pluck/hold envelope through the loud chain. */
function playNote(c: AudioContext, input: AudioNode, t0: number, n: Note): OscillatorNode[] {
  const start = t0 + n.at;
  const env = c.createGain();
  env.gain.setValueAtTime(0.0001, start);
  env.gain.exponentialRampToValueAtTime(n.level, start + 0.008);
  env.gain.setValueAtTime(n.level, start + Math.max(0.02, n.dur - 0.06));
  env.gain.exponentialRampToValueAtTime(0.0001, start + n.dur);
  env.connect(input);

  const made: OscillatorNode[] = [];
  const voices: Array<[OscillatorType, number, number]> = [
    [n.type ?? "square", n.freq, 1],
    ["sawtooth", n.freq / 2, 0.35],
  ];
  for (const [type, freq, rel] of voices) {
    const o = c.createOscillator();
    o.type = type;
    o.frequency.value = freq;
    const g = c.createGain();
    g.gain.value = rel * 0.6;
    o.connect(g).connect(env);
    o.start(start);
    o.stop(start + n.dur + 0.05);
    made.push(o);
  }
  return made;
}

/** Build the note list for a built-in melody. Loops so one burst lasts ~2.5 s. */
function melodyNotes(sound: AlarmSound): Note[] {
  const notes: Note[] = [];
  const push = (seq: Array<[string, number]>, step: number, loops: number, level: number, type?: OscillatorType) => {
    for (let l = 0; l < loops; l++) {
      seq.forEach(([name, mul], i) => {
        notes.push({
          at: (l * seq.length + i) * step,
          freq: NOTE[name] ?? 440,
          dur: step * mul,
          level,
          type,
        });
      });
    }
  };

  switch (sound) {
    case "chime": // bell carillon, Westminster-ish fragment
      push(
        [["E5", 0.95], ["C5", 0.95], ["D5", 0.95], ["G4", 1.6], ["G4", 0.9], ["D5", 0.95], ["E5", 0.95], ["C5", 1.6]],
        0.3,
        1,
        0.9,
        "triangle",
      );
      break;
    case "marimba": // bright bouncy arpeggio
      push(
        [["C5", 0.9], ["E5", 0.9], ["G5", 0.9], ["C6", 0.9], ["G5", 0.9], ["E5", 0.9]],
        0.14,
        3,
        0.95,
        "triangle",
      );
      break;
    case "melody": // playful rising arcade motif
      push(
        [["C5", 0.8], ["E5", 0.8], ["G5", 0.8], ["A5", 0.8], ["G5", 1.4], ["E5", 1.4]],
        0.16,
        3,
        0.95,
        "square",
      );
      break;
    case "alert": // tense two-note movie alarm
      push([["A5", 0.55], ["F5", 0.55]], 0.18, 8, 0.98, "square");
      break;
    default:
      break;
  }
  return notes;
}

// --- ring / siren (the original, kept as options) -----------------------

function playRing(c: AudioContext, input: AudioNode, hard: boolean): OscillatorNode[] {
  const tones: [number, number] = hard ? [640, 880] : [440, 554];
  const pulses = hard ? 9 : 3;
  const onMs = hard ? 180 : 300;
  const offMs = hard ? 95 : 190;
  const level = hard ? 0.98 : 0.68;
  const t0 = c.currentTime;
  const stepS = (onMs + offMs) / 1000;
  const onS = onMs / 1000;
  const burstS = pulses * stepS;

  const tremolo = c.createGain();
  tremolo.gain.value = 0.78;
  tremolo.connect(input);
  const lfo = c.createOscillator();
  lfo.type = "sine";
  lfo.frequency.value = hard ? 17 : 11;
  const lfoDepth = c.createGain();
  lfoDepth.gain.value = 0.32;
  lfo.connect(lfoDepth).connect(tremolo.gain);
  lfo.start(t0);
  lfo.stop(t0 + burstS + 0.1);
  const started: OscillatorNode[] = [lfo];

  for (let i = 0; i < pulses; i++) {
    const start = t0 + i * stepS;
    const env = c.createGain();
    env.gain.setValueAtTime(0.0001, start);
    env.gain.exponentialRampToValueAtTime(level, start + 0.006);
    env.gain.setValueAtTime(level, start + onS - 0.03);
    env.gain.exponentialRampToValueAtTime(0.0001, start + onS);
    env.connect(tremolo);
    for (const [type, freq, rel] of [
      ["square", tones[0], 1],
      ["square", tones[1], 0.9],
      ["sawtooth", tones[0] / 2, 0.5],
    ] as Array<[OscillatorType, number, number]>) {
      const o = c.createOscillator();
      o.type = type;
      o.frequency.value = freq;
      const g = c.createGain();
      g.gain.value = rel * 0.6;
      o.connect(g).connect(env);
      o.start(start);
      o.stop(start + onS + 0.03);
      started.push(o);
    }
  }

  if (hard) {
    const siren = c.createOscillator();
    siren.type = "sawtooth";
    const sg = c.createGain();
    sg.gain.value = level * 0.45;
    siren.frequency.setValueAtTime(520, t0);
    for (let s = 0; s < 4; s++) {
      const mid = t0 + (burstS * (s + 0.5)) / 4;
      const end = t0 + (burstS * (s + 1)) / 4;
      siren.frequency.linearRampToValueAtTime(1180, mid);
      siren.frequency.linearRampToValueAtTime(520, end);
    }
    siren.connect(sg).connect(input);
    siren.start(t0);
    siren.stop(t0 + burstS + 0.05);
    started.push(siren);
  }
  return started;
}

function playSiren(c: AudioContext, input: AudioNode): OscillatorNode[] {
  const t0 = c.currentTime;
  const dur = 2.6;
  const osc = c.createOscillator();
  osc.type = "sawtooth";
  const g = c.createGain();
  g.gain.value = 0.95;
  osc.frequency.setValueAtTime(600, t0);
  for (let s = 0; s < 6; s++) {
    const mid = t0 + (dur * (s + 0.5)) / 6;
    const end = t0 + (dur * (s + 1)) / 6;
    osc.frequency.linearRampToValueAtTime(1250, mid);
    osc.frequency.linearRampToValueAtTime(600, end);
  }
  osc.connect(g).connect(input);
  osc.start(t0);
  osc.stop(t0 + dur + 0.05);
  return [osc];
}

// --- custom file --------------------------------------------------------

let customBuffer: AudioBuffer | null = null;
let customFrom: string | null = null;

async function ensureCustom(c: AudioContext, dataUrl: string | undefined): Promise<AudioBuffer | null> {
  if (!dataUrl) {
    customBuffer = null;
    customFrom = null;
    return null;
  }
  if (customFrom === dataUrl && customBuffer) return customBuffer;
  try {
    const bytes = await (await fetch(dataUrl)).arrayBuffer();
    customBuffer = await c.decodeAudioData(bytes);
    customFrom = dataUrl;
    return customBuffer;
  } catch {
    customBuffer = null;
    customFrom = null;
    return null;
  }
}

/** Pre-load / validate a custom sound. Returns true if it decoded. */
export async function loadCustomAlarm(dataUrl: string | null): Promise<boolean> {
  const c = getCtx();
  if (!c) return false;
  const buf = await ensureCustom(c, dataUrl ?? undefined);
  return !!buf || dataUrl == null;
}

// --- public play -------------------------------------------------------

function currentSound(): { sound: AlarmSound; customData?: string } {
  try {
    const cfg = loadLocalConfig() as { alarmSound?: AlarmSound; alarmCustomData?: string };
    const sound = ALARM_SOUNDS.includes(cfg.alarmSound as AlarmSound)
      ? (cfg.alarmSound as AlarmSound)
      : "ring";
    return { sound, customData: cfg.alarmCustomData };
  } catch {
    return { sound: "ring" };
  }
}

function render(c: AudioContext, sound: AlarmSound, hard: boolean, customData?: string): void {
  const input = getChainInput(c);

  if (sound === "custom") {
    void ensureCustom(c, customData).then((buf) => {
      if (!buf) {
        // no / broken custom file — fall back to the ring so an alarm still sounds
        playRing(c, input, hard);
        return;
      }
      const src = c.createBufferSource();
      src.buffer = buf;
      const g = c.createGain();
      g.gain.value = 1;
      src.connect(g).connect(input);
      src.start();
    });
    return;
  }
  if (sound === "ring") {
    playRing(c, input, hard);
    return;
  }
  if (sound === "siren") {
    playSiren(c, input);
    return;
  }
  // a built-in melody
  const t0 = c.currentTime;
  for (const n of melodyNotes(sound)) playNote(c, input, t0, n);
}

/**
 * `hard` — the operator-selected alarm (a melody, ring, siren or custom file),
 * played when the paid time is reached or exceeded.
 * `soft` — a fixed gentle pre-alert ring (kept low-key since it fires every few
 * minutes during the pre-alert window).
 * Repeats are driven by the caller (`soundRepeatSeconds`).
 */
export function playChime(kind: ChimeKind): void {
  const c = getCtx();
  if (!c) return;
  if (c.state === "suspended") void c.resume().catch(() => undefined);
  if (c.state !== "running") return;

  if (kind === "soft") {
    playRing(c, getChainInput(c), false);
    return;
  }
  const { sound, customData } = currentSound();
  render(c, sound, true, customData);
}

/** Play a specific alarm once, for the Settings preview button. */
export function previewAlarm(sound: AlarmSound, customData?: string): void {
  const c = getCtx();
  if (!c || c.state !== "running") return;
  render(c, sound, true, customData);
}
