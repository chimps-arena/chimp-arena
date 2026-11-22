/**
 * Astroworld's sound, synthesised in code with the Web Audio API: no audio
 * files to download. Browsers only allow sound after a click or key press,
 * so startAudio() is called from the first one (the click that captures the
 * mouse, or a touch on phones).
 *
 * Everything is a short function call (sfx.shot(), sfx.step()...), safe to
 * call before audio has started (it just does nothing).
 */

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let sfxBus: GainNode | null = null;
let ambientBus: GainNode | null = null;
let noise: AudioBuffer | null = null;
let muted = false;

const KEY = "astroworld:muted";
try {
  muted = typeof localStorage !== "undefined" && localStorage.getItem(KEY) === "1";
} catch {
  /* private mode */
}

const subs = new Set<() => void>();
export const audioStore = {
  get: () => muted,
  subscribe: (cb: () => void) => {
    subs.add(cb);
    return () => void subs.delete(cb);
  },
};

export function setMuted(m: boolean) {
  muted = m;
  try {
    localStorage.setItem(KEY, m ? "1" : "0");
  } catch {
    /* private mode */
  }
  if (master && ctx) master.gain.setTargetAtTime(m ? 0 : 0.8, ctx.currentTime, 0.05);
  subs.forEach((cb) => cb());
}

/** Call from a user gesture. Creates the audio graph once, and starts the ambience. */
export function startAudio() {
  if (typeof window === "undefined") return;
  if (ctx) {
    if (ctx.state === "suspended") void ctx.resume();
    return;
  }
  const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AC) return;
  ctx = new AC();
  master = ctx.createGain();
  master.gain.value = muted ? 0 : 0.8;
  // Gentle limiter so overlapping gunfire never clips.
  const comp = ctx.createDynamicsCompressor();
  comp.threshold.value = -14;
  comp.ratio.value = 6;
  master.connect(comp).connect(ctx.destination);
  sfxBus = ctx.createGain();
  sfxBus.gain.value = 0.9;
  sfxBus.connect(master);
  ambientBus = ctx.createGain();
  ambientBus.gain.value = 0;
  ambientBus.connect(master);

  // Two seconds of white noise, reused by every noisy sound.
  noise = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
  const d = noise.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;

  startAmbience();
}

/* ------------------------------ building blocks ------------------------------ */

function noiseBurst(opts: { dur: number; gain: number; freq: number; q?: number; type?: BiquadFilterType; decay?: number; when?: number; pan?: number; out?: AudioNode }) {
  if (!ctx || !noise) return;
  const t = ctx.currentTime + (opts.when ?? 0);
  const src = ctx.createBufferSource();
  src.buffer = noise;
  src.playbackRate.value = 0.8 + Math.random() * 0.4;
  const f = ctx.createBiquadFilter();
  f.type = opts.type ?? "bandpass";
  f.frequency.value = opts.freq;
  f.Q.value = opts.q ?? 1;
  const g = ctx.createGain();
  g.gain.setValueAtTime(opts.gain, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + (opts.decay ?? opts.dur));
  const p = ctx.createStereoPanner();
  p.pan.value = opts.pan ?? 0;
  src.connect(f).connect(g).connect(p).connect(opts.out ?? sfxBus!);
  src.start(t, Math.random() * 1.5, opts.dur + 0.05);
}

function tone(opts: { freq: number; to?: number; dur: number; gain: number; type?: OscillatorType; when?: number; attack?: number; out?: AudioNode }) {
  if (!ctx) return;
  const t = ctx.currentTime + (opts.when ?? 0);
  const o = ctx.createOscillator();
  o.type = opts.type ?? "sine";
  o.frequency.setValueAtTime(opts.freq, t);
  if (opts.to) o.frequency.exponentialRampToValueAtTime(opts.to, t + opts.dur);
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(opts.gain, t + (opts.attack ?? 0.005));
  g.gain.exponentialRampToValueAtTime(0.0001, t + opts.dur);
  o.connect(g).connect(opts.out ?? sfxBus!);
  o.start(t);
  o.stop(t + opts.dur + 0.05);
}

/** Volume and stereo position for a sound at distance d (metres), off to the side by `side` (-1 left .. 1 right). */
const falloff = (d: number) => Math.max(0, 1 / (1 + (d / 18) ** 1.6));

/* ------------------------------ the sounds ------------------------------ */

let lastStep = 0;

export const sfx = {
  /** Your own rifle: punchy crack + low thump. */
  shot() {
    noiseBurst({ dur: 0.12, gain: 0.9, freq: 1800, q: 0.7, decay: 0.12 });
    noiseBurst({ dur: 0.25, gain: 0.5, freq: 400, q: 0.8, type: "lowpass", decay: 0.25 });
    tone({ freq: 140, to: 50, dur: 0.12, gain: 0.5, type: "triangle" });
  },
  /** Someone else's shot, quieter and duller with distance. */
  remoteShot(distance: number, side: number) {
    const v = falloff(distance);
    if (v < 0.02) return;
    noiseBurst({ dur: 0.18, gain: 0.7 * v, freq: 1200 - Math.min(900, distance * 8), q: 0.6, decay: 0.18 + distance / 400, pan: side * 0.8 });
  },
  /** Your bullet landed. */
  hit() {
    tone({ freq: 1800, dur: 0.05, gain: 0.25, type: "square" });
    noiseBurst({ dur: 0.04, gain: 0.3, freq: 4000, q: 2 });
  },
  /** You got the kill. */
  kill() {
    tone({ freq: 880, dur: 0.12, gain: 0.3, type: "triangle" });
    tone({ freq: 1320, dur: 0.2, gain: 0.25, type: "triangle", when: 0.08 });
  },
  /** You were hit. */
  hurt() {
    tone({ freq: 90, to: 45, dur: 0.25, gain: 0.7, type: "sine" });
    noiseBurst({ dur: 0.15, gain: 0.4, freq: 300, type: "lowpass", decay: 0.2 });
  },
  /** You died. */
  death() {
    tone({ freq: 220, to: 55, dur: 1.2, gain: 0.45, type: "sawtooth", attack: 0.02 });
    noiseBurst({ dur: 0.9, gain: 0.25, freq: 250, type: "lowpass", decay: 1 });
  },
  reload() {
    noiseBurst({ dur: 0.04, gain: 0.35, freq: 2600, q: 4 });
    noiseBurst({ dur: 0.05, gain: 0.4, freq: 1700, q: 5, when: 0.55 });
    tone({ freq: 600, dur: 0.05, gain: 0.15, type: "square", when: 1.1 });
    noiseBurst({ dur: 0.05, gain: 0.45, freq: 2200, q: 5, when: 1.2 });
  },
  /** Empty magazine click. */
  dry() {
    noiseBurst({ dur: 0.03, gain: 0.3, freq: 3000, q: 6 });
  },
  /** A footstep; rate-limited by the caller's speed. */
  step(sprint: boolean) {
    const now = performance.now();
    if (now - lastStep < 120) return;
    lastStep = now;
    noiseBurst({ dur: 0.07, gain: sprint ? 0.16 : 0.11, freq: 500 + Math.random() * 200, q: 1.2, type: "lowpass", decay: 0.08 });
  },
  jump() {
    noiseBurst({ dur: 0.1, gain: 0.12, freq: 700, type: "lowpass" });
  },
  /** Menus, talking, using things. */
  ui() {
    tone({ freq: 660, dur: 0.06, gain: 0.12, type: "triangle" });
    tone({ freq: 990, dur: 0.08, gain: 0.1, type: "triangle", when: 0.05 });
  },
  /** Story step done. */
  objective() {
    tone({ freq: 523, dur: 0.15, gain: 0.18, type: "triangle" });
    tone({ freq: 659, dur: 0.15, gain: 0.18, type: "triangle", when: 0.1 });
    tone({ freq: 784, dur: 0.3, gain: 0.2, type: "triangle", when: 0.2 });
  },
  /** Ship take-off and landing. */
  flight() {
    noiseBurst({ dur: 2.4, gain: 0.35, freq: 200, q: 0.5, type: "lowpass", decay: 2.4 });
    tone({ freq: 70, to: 140, dur: 1.4, gain: 0.3, type: "sawtooth", attack: 0.4 });
  },
};

/* ------------------------------ ambience ------------------------------ */

/** Low wind over the plains plus a faint electrical hum from the Core. */
function startAmbience() {
  if (!ctx || !noise || !ambientBus) return;
  const wind = ctx.createBufferSource();
  wind.buffer = noise;
  wind.loop = true;
  const lp = ctx.createBiquadFilter();
  lp.type = "lowpass";
  lp.frequency.value = 380;
  // Slow gusts.
  const lfo = ctx.createOscillator();
  lfo.frequency.value = 0.07;
  const lfoGain = ctx.createGain();
  lfoGain.gain.value = 160;
  lfo.connect(lfoGain).connect(lp.frequency);
  const wg = ctx.createGain();
  wg.gain.value = 0.22;
  wind.connect(lp).connect(wg).connect(ambientBus);
  wind.start();
  lfo.start();

  const hum = ctx.createOscillator();
  hum.frequency.value = 55;
  const hg = ctx.createGain();
  hg.gain.value = 0.025;
  hum.connect(hg).connect(ambientBus);
  hum.start();

  ambientBus.gain.setTargetAtTime(1, ctx.currentTime, 2);
}
