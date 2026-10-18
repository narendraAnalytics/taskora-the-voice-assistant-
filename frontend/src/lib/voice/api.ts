/* Calls to the Taskora FastAPI voice backend. Sarvam's key stays on that server. */

const BASE = (process.env.NEXT_PUBLIC_VOICE_API_URL ?? "http://localhost:8000").replace(/\/$/, "");

export type Transcript = { text: string; language_code: string };

async function ensureOk(res: Response) {
  if (!res.ok) throw new Error(`Voice service ${res.status}`);
  return res;
}

export async function transcribe(wav: Blob, token: string | null, keyterms: string[] = []): Promise<Transcript> {
  const form = new FormData();
  form.append("audio", wav, "standup.wav");
  if (keyterms.length) form.append("keyterms", JSON.stringify(keyterms));
  const res = await ensureOk(
    await fetch(`${BASE}/voice/stt`, {
      method: "POST",
      body: form,
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    }),
  );
  return res.json();
}

export async function synthesize(text: string, token: string | null, languageCode = "en-IN"): Promise<ArrayBuffer> {
  const res = await ensureOk(
    await fetch(`${BASE}/voice/tts`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      // mp3 is ~3x smaller than wav; an older backend ignores `codec` and sends wav, which decodes too.
      body: JSON.stringify({ text, language_code: languageCode, codec: "mp3" }),
    }),
  );
  return res.arrayBuffer();
}
