/*
 * Mic capture that works in every browser (unlike the Web Speech API): AudioWorklet -> mono
 * Float32 chunks -> downsample to 16 kHz -> 16-bit WAV, the format Sarvam STT likes best.
 * Also reports loudness (for the avatar) and detects silence so the take can end by itself.
 */

const TARGET_RATE = 16000;
const SPEECH_RMS = 0.02; // below this counts as silence
const SILENCE_MS = 1300; // stop this long after the speaker goes quiet

export type Recorder = {
  /** Stop capturing and return the 16 kHz mono WAV. */
  finish: () => Promise<Blob>;
  /** Drop everything without producing audio. */
  cancel: () => void;
};

export async function startRecorder(opts: {
  onLevel?: (level: number) => void;
  /** Called once when speech was heard and then ~1.3 s of silence followed. */
  onSilence?: () => void;
}): Promise<Recorder> {
  const stream = await navigator.mediaDevices.getUserMedia({
    audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true, autoGainControl: true },
  });
  const ctx = new AudioContext();
  try {
    await ctx.audioWorklet.addModule("/worklets/pcm.js");
  } catch (e) {
    stream.getTracks().forEach((t) => t.stop());
    void ctx.close();
    throw e;
  }
  const source = ctx.createMediaStreamSource(stream);
  const node = new AudioWorkletNode(ctx, "pcm-capture");
  const mute = ctx.createGain(); // keeps the node pulled by the graph without playing the mic back
  mute.gain.value = 0;
  source.connect(node).connect(mute).connect(ctx.destination);

  const chunks: Float32Array[] = [];
  let heardSpeech = false;
  let lastVoice = performance.now();
  let level = 0;
  let notified = false;

  node.port.onmessage = (e: MessageEvent<Float32Array>) => {
    const data = e.data;
    chunks.push(data);
    let sum = 0;
    for (let i = 0; i < data.length; i++) sum += data[i] * data[i];
    const rms = Math.sqrt(sum / data.length);
    level = level * 0.6 + Math.min(rms * 6, 1) * 0.4;
    opts.onLevel?.(level);
    const now = performance.now();
    if (rms > SPEECH_RMS) {
      heardSpeech = true;
      lastVoice = now;
    } else if (heardSpeech && !notified && now - lastVoice > SILENCE_MS) {
      notified = true;
      opts.onSilence?.();
    }
  };

  const teardown = () => {
    node.port.onmessage = null;
    source.disconnect();
    node.disconnect();
    stream.getTracks().forEach((t) => t.stop());
    void ctx.close();
    opts.onLevel?.(0);
  };

  return {
    finish: async () => {
      const rate = ctx.sampleRate;
      teardown();
      return encodeWav(downsample(concat(chunks), rate, TARGET_RATE), TARGET_RATE);
    },
    cancel: teardown,
  };
}

function concat(parts: Float32Array[]): Float32Array {
  const out = new Float32Array(parts.reduce((n, p) => n + p.length, 0));
  let o = 0;
  for (const p of parts) {
    out.set(p, o);
    o += p.length;
  }
  return out;
}

/** Box-filter downsample (averages each window) — plenty for speech. */
function downsample(input: Float32Array, from: number, to: number): Float32Array {
  if (from <= to) return input;
  const ratio = from / to;
  const out = new Float32Array(Math.floor(input.length / ratio));
  for (let i = 0; i < out.length; i++) {
    const start = Math.floor(i * ratio);
    const end = Math.min(Math.floor((i + 1) * ratio), input.length);
    let sum = 0;
    for (let j = start; j < end; j++) sum += input[j];
    out[i] = sum / Math.max(end - start, 1);
  }
  return out;
}

function encodeWav(samples: Float32Array, rate: number): Blob {
  const buf = new ArrayBuffer(44 + samples.length * 2);
  const v = new DataView(buf);
  const str = (o: number, s: string) => [...s].forEach((c, i) => v.setUint8(o + i, c.charCodeAt(0)));
  str(0, "RIFF");
  v.setUint32(4, 36 + samples.length * 2, true);
  str(8, "WAVE");
  str(12, "fmt ");
  v.setUint32(16, 16, true);
  v.setUint16(20, 1, true); // PCM
  v.setUint16(22, 1, true); // mono
  v.setUint32(24, rate, true);
  v.setUint32(28, rate * 2, true);
  v.setUint16(32, 2, true);
  v.setUint16(34, 16, true);
  str(36, "data");
  v.setUint32(40, samples.length * 2, true);
  for (let i = 0; i < samples.length; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    v.setInt16(44 + i * 2, s < 0 ? s * 0x8000 : s * 0x7fff, true);
  }
  return new Blob([buf], { type: "audio/wav" });
}
