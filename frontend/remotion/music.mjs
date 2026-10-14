// Composes the intro's background music in code, so there is nothing to license: a tanpura drone,
// warm pad chords (vi–IV–I–V in D), soft santoor-like plucks from the "Interns speak" scene on,
// bells at "Target achieved", and a resolving D chord on the logo. Deterministic: same file every run.
// Writes remotion/assets/music/theme.wav (44.1 kHz stereo).
//
//   pnpm video:music
import { mkdir, writeFile } from "node:fs/promises";

const SR = 44100;
const LENGTH = 25; // seconds: HeroLoop's DURATION / FPS
const BRAND = 20.5; // seconds: the brand scene, where the progression resolves
const BAR = BRAND / 8; // eight bars lead into the logo
const EIGHTH = BAR / 8;
const N = Math.ceil(LENGTH * SR);
const TAU = Math.PI * 2;

const L = new Float32Array(N);
const R = new Float32Array(N);
const send = new Float32Array(N); // reverb send (mono in, stereo out)

let seed = 7;
const rnd = () => {
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

const SEMIS = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
const hz = (name) => {
  const [, letter, sharp, octave] = /^([A-G])(#?)(\d)$/.exec(name);
  const midi = 12 * (Number(octave) + 1) + SEMIS[letter] + (sharp ? 1 : 0);
  return 440 * 2 ** ((midi - 69) / 12);
};

/** Equal-power pan, -1 (left) … 1 (right). */
const gains = (pan) => [Math.cos(((pan + 1) * Math.PI) / 4), Math.sin(((pan + 1) * Math.PI) / 4)];

function add(i, v, [gl, gr], wet) {
  if (i < 0 || i >= N) return;
  L[i] += v * gl;
  R[i] += v * gr;
  send[i] += v * wet;
}

/** Soft, slowly breathing pad note: two detuned voices panned apart. */
function pad(start, dur, freq, amp) {
  const attack = 1.1;
  const release = 1.8;
  const s0 = Math.round(start * SR);
  const len = Math.round((dur + release) * SR);
  for (const detune of [-0.003, 0.003]) {
    const f = freq * (1 + detune);
    const g = gains(detune < 0 ? -0.4 : 0.4);
    const phase = rnd() * TAU;
    for (let n = 0; n < len; n++) {
      const t = n / SR;
      const env =
        t < attack ? (1 - Math.cos((Math.PI * t) / attack)) / 2 : t < dur ? 1 : Math.max(0, 1 - (t - dur) / release) ** 2;
      const w = TAU * f * t + phase;
      const tone = Math.sin(w) + 0.28 * Math.sin(2 * w) + 0.1 * Math.sin(3 * w) + 0.04 * Math.sin(4 * w);
      add(s0 + n, tone * env * amp * (1 + 0.06 * Math.sin(TAU * 0.23 * t)), g, 0.55);
    }
  }
}

/** Tanpura-style pluck: rich harmonics that swell and fade at different rates (the jivari shimmer). */
function tanpura(start, freq, amp, pan) {
  const s0 = Math.round(start * SR);
  const len = Math.round(4.5 * SR);
  const g = gains(pan);
  for (let n = 0; n < len; n++) {
    const t = n / SR;
    let v = 0;
    for (let h = 1; h <= 14; h++) {
      const decay = Math.exp(-t * (0.55 + 0.22 * h));
      const shimmer = 0.6 + 0.4 * Math.sin(TAU * (0.3 + 0.07 * h) * t + h);
      v += (Math.sin(TAU * freq * h * t) * decay * shimmer) / h ** 0.9;
    }
    add(s0 + n, v * amp * Math.min(1, t / 0.012), g, 0.45);
  }
}

/** Karplus-Strong plucked string, softened, for the santoor-like melody. */
function pluck(start, freq, amp, pan) {
  const s0 = Math.round(start * SR);
  const len = Math.round(2.6 * SR);
  const g = gains(pan);
  const period = Math.max(2, Math.round(SR / freq - 0.5)); // the averaging filter adds half a sample
  const buf = new Float32Array(period);
  let lp = 0;
  for (let k = 0; k < period; k++) buf[k] = lp = 0.55 * lp + 0.45 * (rnd() * 2 - 1);
  let idx = 0;
  for (let n = 0; n < len; n++) {
    const t = n / SR;
    const out = buf[idx];
    const next = (idx + 1) % period;
    buf[idx] = 0.997 * 0.5 * (out + buf[next]);
    idx = next;
    add(s0 + n, out * amp * Math.min(1, t / 0.004) * Math.exp(-t * 0.9), g, 0.5);
  }
}

/** Small bell: a sine with two inharmonic partials that die away first. */
function bell(start, freq, amp, pan) {
  const s0 = Math.round(start * SR);
  const len = Math.round(3 * SR);
  const g = gains(pan);
  for (let n = 0; n < len; n++) {
    const t = n / SR;
    const v =
      Math.sin(TAU * freq * t) +
      0.35 * Math.sin(TAU * freq * 2.76 * t) * Math.exp(-t * 3) +
      0.15 * Math.sin(TAU * freq * 5.4 * t) * Math.exp(-t * 6);
    add(s0 + n, v * amp * Math.min(1, t / 0.003) * Math.exp(-t * 1.6), g, 0.7);
  }
}

/* ── Score ─────────────────────────────────────────────────────────────── */

// vi–IV–I–V twice, then D on the logo. Each chord: pad voicing + bass.
const CHORDS = [
  { notes: ["B3", "D4", "F#4"], bass: "B2" }, // Status goes stale
  { notes: ["B3", "D4", "G4"], bass: "G2" },
  { notes: ["A3", "D4", "F#4"], bass: "D3" }, // Interns speak
  { notes: ["A3", "C#4", "E4"], bass: "A2" },
  { notes: ["B3", "D4", "F#4"], bass: "B2" }, // The board updates
  { notes: ["B3", "D4", "G4"], bass: "G2" },
  { notes: ["A3", "D4", "F#4"], bass: "D3" }, // Target achieved
  { notes: ["A3", "C#4", "E4"], bass: "A2" },
];
// The piece starts hushed and opens up as the story turns around.
const LEVEL = [0.55, 0.6, 0.8, 0.85, 0.85, 0.9, 1, 1];

CHORDS.forEach(({ notes, bass }, bar) => {
  const t = bar * BAR;
  for (const n of notes) pad(t, BAR, hz(n), 0.032 * LEVEL[bar]);
  pad(t, BAR, hz(bass), 0.04 * LEVEL[bar]);
});
for (const n of ["A3", "D4", "F#4", "A4"]) pad(BRAND, LENGTH - BRAND, hz(n), 0.034);
pad(BRAND, LENGTH - BRAND, hz("D3"), 0.045);

// Tanpura cycle every bar: Pa, Sa', Sa', Sa (low).
for (let bar = 0; bar <= 8; bar++) {
  const t = bar * BAR;
  if (t >= LENGTH - 1.5) break;
  tanpura(t, hz("A2"), 0.016, -0.5);
  tanpura(t + BAR * 0.25, hz("D3"), 0.013, -0.2);
  tanpura(t + BAR * 0.5, hz("D3"), 0.013, 0.2);
  tanpura(t + BAR * 0.75, hz("D2"), 0.02, 0.5);
}

// Melody in Bhupali (D E F# A B), one entry per eighth note; null is a rest.
const MELODY = [
  [null, null, null, null, null, null, null, null],
  [null, null, null, null, "B4", null, "A4", null], // a quiet question
  ["F#4", null, "A4", null, "D5", null, "A4", null],
  ["E4", null, "A4", null, "B4", null, "A4", "E4"],
  ["F#4", null, "B4", null, "D5", null, "B4", null],
  ["D5", null, "B4", null, "A4", null, null, null],
  ["A4", "D5", "F#5", null, "E5", "D5", null, "A4"],
  ["E5", null, "A4", null, "B4", "D5", "E5", null],
];
MELODY.forEach((bar, b) =>
  bar.forEach((n, k) => {
    if (!n) return;
    const accent = k % 4 === 0 ? 1 : 0.8;
    pluck(b * BAR + k * EIGHTH, hz(n), (b < 2 ? 0.1 : 0.16) * accent, k % 2 ? 0.3 : -0.15);
  }),
);
// Resolve: a slow rising D arpeggio under the logo.
["D4", "F#4", "A4", "D5", "F#5"].forEach((n, k) => pluck(BRAND + k * EIGHTH * 1.5, hz(n), 0.14, -0.3 + k * 0.15));

// Bells for "Target achieved" and the logo.
bell(6 * BAR, hz("D6"), 0.035, 0.4);
bell(6 * BAR + BAR / 2, hz("A5"), 0.03, -0.3);
bell(7 * BAR, hz("E6"), 0.03, 0.3);
bell(BRAND, hz("D6"), 0.04, 0.2);
bell(BRAND + 0.02, hz("F#6"), 0.025, -0.2);

/* ── Reverb (Freeverb-style) ───────────────────────────────────────────── */

function reverb(input, combs, allpasses) {
  const out = new Float32Array(N);
  for (const size of combs) {
    const buf = new Float32Array(size);
    let i = 0;
    let store = 0;
    for (let n = 0; n < N; n++) {
      const y = buf[i];
      store = y * 0.75 + store * 0.25; // damping
      buf[i] = input[n] * 0.03 + store * 0.84;
      out[n] += y;
      i = (i + 1) % size;
    }
  }
  for (const size of allpasses) {
    const buf = new Float32Array(size);
    let i = 0;
    for (let n = 0; n < N; n++) {
      const b = buf[i];
      buf[i] = out[n] + b * 0.5;
      out[n] = b - out[n];
      i = (i + 1) % size;
    }
  }
  return out;
}
const wetL = reverb(send, [1116, 1277, 1422, 1557], [556, 441]);
const wetR = reverb(send, [1188, 1356, 1491, 1617], [579, 464]);

/* ── Master: mix, gentle fades, normalise, write WAV ───────────────────── */

const FADE_IN = 0.8;
const FADE_OUT = 1.6;
let peak = 0;
for (let n = 0; n < N; n++) {
  const t = n / SR;
  const fade = Math.min(1, t / FADE_IN, (LENGTH - t) / FADE_OUT);
  L[n] = Math.tanh((L[n] + wetL[n]) * 1.2) * Math.max(0, fade);
  R[n] = Math.tanh((R[n] + wetR[n]) * 1.2) * Math.max(0, fade);
  peak = Math.max(peak, Math.abs(L[n]), Math.abs(R[n]));
}
const gain = 0.6 / peak; // about -4.4 dBFS

const data = Buffer.alloc(N * 4);
for (let n = 0; n < N; n++) {
  data.writeInt16LE(Math.round(Math.max(-1, Math.min(1, L[n] * gain)) * 32767), n * 4);
  data.writeInt16LE(Math.round(Math.max(-1, Math.min(1, R[n] * gain)) * 32767), n * 4 + 2);
}
const header = Buffer.alloc(44);
header.write("RIFF", 0);
header.writeUInt32LE(36 + data.length, 4);
header.write("WAVEfmt ", 8);
header.writeUInt32LE(16, 16);
header.writeUInt16LE(1, 20); // PCM
header.writeUInt16LE(2, 22); // stereo
header.writeUInt32LE(SR, 24);
header.writeUInt32LE(SR * 4, 28);
header.writeUInt16LE(4, 32);
header.writeUInt16LE(16, 34);
header.write("data", 36);
header.writeUInt32LE(data.length, 40);

const outDir = new URL("assets/music/", import.meta.url);
await mkdir(outDir, { recursive: true });
await writeFile(new URL("theme.wav", outDir), Buffer.concat([header, data]));
console.log(`theme.wav: ${LENGTH}s, peak before normalise ${peak.toFixed(2)}`);
