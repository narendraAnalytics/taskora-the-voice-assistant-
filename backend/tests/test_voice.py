import base64
import io
import wave

import httpx
import pytest
from fastapi.testclient import TestClient

from app.config import Settings, get_settings
from app.sarvam import SarvamClient, clean_keyterms, join_wav, split_text


def wav(n=10):
    b = io.BytesIO()
    with wave.open(b, "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(24000)
        w.writeframes(b"\x00\x00" * n)
    return b.getvalue()


def test_split_text_respects_limit():
    text = ". ".join(["word " * 30] * 40)
    chunks = split_text(text, 500)
    assert all(len(c) <= 500 for c in chunks)
    assert len(chunks) > 1


def test_clean_keyterms_drops_duplicates_and_blanks():
    assert clean_keyterms(["Ravi", " ravi ", "", "Ravi K", "Ravi"]) == ["Ravi", "Ravi K"]
    assert len(clean_keyterms([f"n{i}" for i in range(80)])) == 50


def test_join_wav_concats_frames():
    out = join_wav([wav(10), wav(5)])
    with wave.open(io.BytesIO(out)) as r:
        assert r.getnframes() == 15


@pytest.fixture
def client(monkeypatch):
    monkeypatch.setenv("SARVAM_API_KEY", "k")
    get_settings.cache_clear()
    settings = Settings(_env_file=None)

    def handler(req: httpx.Request) -> httpx.Response:
        assert req.headers["api-subscription-key"] == "k"
        if req.url.path == "/speech-to-text":
            return httpx.Response(200, json={"transcript": "hello", "language_code": "en-IN"})
        return httpx.Response(200, json={"audios": [base64.b64encode(wav()).decode()]})

    from app.main import create_app

    app = create_app()
    app.dependency_overrides[get_settings] = lambda: settings
    with TestClient(app) as c:
        app.state.sarvam = SarvamClient(
            settings, httpx.AsyncClient(transport=httpx.MockTransport(handler))
        )
        yield c


def test_stt(client):
    r = client.post("/voice/stt", files={"audio": ("a.wav", wav(), "audio/wav")})
    assert r.status_code == 200 and r.json()["text"] == "hello"


def test_tts(client):
    r = client.post("/voice/tts", json={"text": "Namaste"})
    assert r.status_code == 200 and r.content[:4] == b"RIFF"


def test_tts_mp3(client):
    r = client.post("/voice/tts", json={"text": "Namaste", "codec": "mp3"})
    assert r.status_code == 200 and r.headers["content-type"] == "audio/mpeg"


def test_tts_rejects_bad_codec(client):
    assert client.post("/voice/tts", json={"text": "x", "codec": "ogg"}).status_code == 422


def test_tts_rejects_bad_language(client):
    assert client.post("/voice/tts", json={"text": "x", "language_code": "xx"}).status_code == 422
