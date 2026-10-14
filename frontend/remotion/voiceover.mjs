// Generates the intro voiceover with Kokoro (open-source TTS, runs locally, no API key).
// Lines, voices and timing live in voiceover.json; WAVs land in remotion/assets/voice/.
// The first run downloads the model (~90 MB) from Hugging Face and caches it.
//
//   pnpm video:voice            all lines
//   pnpm video:voice stale win  only these line ids
import { mkdir, readFile } from "node:fs/promises";
import { KokoroTTS } from "kokoro-js";

const root = new URL("./", import.meta.url);
const outDir = new URL("assets/voice/", root);
const { voices, speed, lines } = JSON.parse(await readFile(new URL("voiceover.json", root), "utf8"));

const only = process.argv.slice(2);
const todo = only.length ? lines.filter((l) => only.includes(l.id)) : lines;
if (!todo.length) throw new Error(`No lines match: ${only.join(", ")}`);

await mkdir(outDir, { recursive: true });
const tts = await KokoroTTS.from_pretrained("onnx-community/Kokoro-82M-v1.0-ONNX", {
  dtype: "q8",
  device: "cpu",
});

/** Kokoro pads each clip with silence; trim it so `at` in voiceover.json is when speech starts. */
function trimSilence(samples, rate, threshold = 0.01, keepMs = 30) {
  const keep = Math.round((rate * keepMs) / 1000);
  let start = samples.findIndex((v) => Math.abs(v) > threshold);
  if (start < 0) return samples;
  let end = samples.length - 1;
  while (end > start && Math.abs(samples[end]) <= threshold) end--;
  start = Math.max(0, start - keep);
  end = Math.min(samples.length, end + 1 + keep * 4);
  return samples.slice(start, end);
}

let over = 0;
for (const line of todo) {
  const audio = await tts.generate(line.text, { voice: voices[line.voice], speed: line.speed ?? speed });
  audio.audio = trimSilence(audio.audio, audio.sampling_rate);
  await audio.save(new URL(`${line.id}.wav`, outDir).pathname.replace(/^\/([A-Za-z]:)/, "$1"));
  const secs = audio.audio.length / audio.sampling_rate;
  const fits = secs <= line.maxSeconds;
  if (!fits) over++;
  console.log(`${fits ? "ok  " : "LONG"} ${line.id.padEnd(7)} ${secs.toFixed(2)}s / ${line.maxSeconds}s  "${line.text}"`);
}

if (over) {
  console.log(`\n${over} line(s) run past their scene. Shorten the text or raise "speed" in voiceover.json.`);
  process.exitCode = 1;
}
