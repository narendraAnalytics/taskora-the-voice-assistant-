"""Server-only Sarvam client. The API key never leaves this process."""

import base64
import io
import json
import re
import wave

import httpx

from app.config import Settings

TTS_MAX_CHARS = 2500


class SarvamError(Exception):
    def __init__(self, status: int, detail: str):
        super().__init__(f"Sarvam {status}: {detail}")
        self.status = status
        self.detail = detail


def split_text(text: str, limit: int = TTS_MAX_CHARS) -> list[str]:
    """Split on sentence ends so each chunk fits one TTS request."""
    text = text.strip()
    if len(text) <= limit:
        return [text] if text else []
    chunks: list[str] = []
    current = ""
    for sentence in re.split(r"(?<=[.!?।])\s+", text):
        while len(sentence) > limit:  # a single huge sentence: hard split
            if current:
                chunks.append(current)
                current = ""
            chunks.append(sentence[:limit])
            sentence = sentence[limit:]
        if current and len(current) + len(sentence) + 1 > limit:
            chunks.append(current)
            current = sentence
        else:
            current = f"{current} {sentence}".strip()
    if current:
        chunks.append(current)
    return chunks


def clean_keyterms(terms: list[str]) -> list[str]:
    """Sarvam rejects duplicates (e.g. 'Ravi' twice) and allows 50 terms of 64 chars."""
    seen: set[str] = set()
    out: list[str] = []
    for t in terms:
        t = t.strip()[:64]
        if t and t.lower() not in seen:
            seen.add(t.lower())
            out.append(t)
    return out[:50]


def join_wav(parts: list[bytes]) -> bytes:
    """Concatenate WAV files that share one format (we always request the same rate)."""
    if not parts:
        return b""
    if len(parts) == 1:
        return parts[0]
    with wave.open(io.BytesIO(parts[0]), "rb") as first:
        params = first.getparams()
    out = io.BytesIO()
    with wave.open(out, "wb") as w:
        w.setparams(params)
        for p in parts:
            with wave.open(io.BytesIO(p), "rb") as r:
                w.writeframes(r.readframes(r.getnframes()))
    return out.getvalue()


class SarvamClient:
    def __init__(self, settings: Settings, http: httpx.AsyncClient):
        self._s = settings
        self._http = http

    @property
    def _headers(self) -> dict[str, str]:
        return {"api-subscription-key": self._s.sarvam_api_key}

    async def transcribe(
        self,
        audio: bytes,
        filename: str = "audio.wav",
        content_type: str = "audio/wav",
        keyterms: list[str] | None = None,
        language_code: str | None = None,
    ) -> dict[str, str]:
        data: dict[str, str] = {"model": self._s.stt_model, "mode": self._s.stt_mode}
        if language_code:
            data["language_code"] = language_code
        terms = clean_keyterms(keyterms or [])
        if terms:
            data["keyterms"] = json.dumps(terms)
        resp = await self._http.post(
            f"{self._s.sarvam_base_url}/speech-to-text",
            headers=self._headers,
            data=data,
            files={"file": (filename, audio, content_type)},
        )
        if resp.status_code != 200:
            raise SarvamError(resp.status_code, resp.text[:300])
        body = resp.json()
        return {
            "text": body.get("transcript", ""),
            "language_code": body.get("language_code") or "",
        }

    async def synthesize(
        self,
        text: str,
        language_code: str = "en-IN",
        speaker: str | None = None,
        codec: str = "wav",
    ) -> bytes:
        """Returns one WAV or MP3 blob; long text is chunked and the chunks joined
        (MP3 frames concatenate as-is)."""
        audios: list[bytes] = []
        for chunk in split_text(text):
            resp = await self._http.post(
                f"{self._s.sarvam_base_url}/text-to-speech",
                headers=self._headers,
                json={
                    "text": chunk,
                    "target_language_code": language_code,
                    "speaker": speaker or self._s.tts_default_speaker,
                    "model": self._s.tts_model,
                    "speech_sample_rate": self._s.tts_sample_rate,
                    "pace": self._s.tts_pace,
                    "temperature": self._s.tts_temperature,
                    "output_audio_codec": codec,
                },
            )
            if resp.status_code != 200:
                raise SarvamError(resp.status_code, resp.text[:300])
            for b64 in resp.json().get("audios", []):
                audios.append(base64.b64decode(b64))
        return join_wav(audios) if codec == "wav" else b"".join(audios)

    async def chat_json(self, system: str, user: str, max_tokens: int = 1500) -> dict:
        """One chat call that must answer with a JSON object. Raises SarvamError if it does not."""
        resp = await self._http.post(
            f"{self._s.sarvam_base_url}/v1/chat/completions",
            headers=self._headers,
            json={
                "model": self._s.chat_model,
                "messages": [{"role": "system", "content": system}, {"role": "user", "content": user}],
                "temperature": 0.1,
                "max_tokens": max_tokens,
                "reasoning_effort": None,  # extraction needs no thinking; it only burns tokens and time
                "response_format": {"type": "json_object"},
            },
        )
        if resp.status_code != 200:
            raise SarvamError(resp.status_code, resp.text[:300])
        content = (resp.json().get("choices") or [{}])[0].get("message", {}).get("content") or ""
        return parse_json_object(content)


def parse_json_object(content: str) -> dict:
    """Models sometimes wrap JSON in prose or code fences; take the outermost {...}."""
    start, end = content.find("{"), content.rfind("}")
    if start < 0 or end <= start:
        raise SarvamError(502, "Model did not return JSON")
    try:
        out = json.loads(content[start : end + 1])
    except json.JSONDecodeError:
        raise SarvamError(502, "Model returned invalid JSON") from None
    if not isinstance(out, dict):
        raise SarvamError(502, "Model returned a non-object")
    return out
