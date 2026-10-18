import json
from typing import Annotated

from fastapi import APIRouter, Depends, File, Form, HTTPException, Request, UploadFile
from fastapi.responses import Response
from pydantic import BaseModel, Field

from app.auth import rate_limit
from app.config import Settings, get_settings
from app.sarvam import SarvamClient, SarvamError

router = APIRouter(prefix="/voice", tags=["voice"])


def get_sarvam(request: Request) -> SarvamClient:
    return request.app.state.sarvam


Sarvam = Annotated[SarvamClient, Depends(get_sarvam)]
Cfg = Annotated[Settings, Depends(get_settings)]
User = Annotated[str, Depends(rate_limit)]


class TranscriptOut(BaseModel):
    text: str
    language_code: str


@router.post("/stt", response_model=TranscriptOut)
async def speech_to_text(
    sarvam: Sarvam,
    cfg: Cfg,
    _user: User,
    audio: Annotated[UploadFile, File()],
    keyterms: Annotated[str | None, Form(description="JSON array of names/task titles")] = None,
):
    data = await audio.read(cfg.max_audio_bytes + 1)
    if len(data) > cfg.max_audio_bytes:
        raise HTTPException(413, "Audio too large")
    if not data:
        raise HTTPException(400, "Empty audio")
    terms: list[str] = []
    if keyterms:
        try:
            terms = [t for t in json.loads(keyterms) if isinstance(t, str)]
        except (json.JSONDecodeError, TypeError):
            raise HTTPException(400, "keyterms must be a JSON array of strings") from None
    try:
        return await sarvam.transcribe(
            data,
            filename=audio.filename or "audio.wav",
            content_type=audio.content_type or "audio/wav",
            keyterms=terms,
        )
    except SarvamError as e:
        raise HTTPException(502, f"Speech service error ({e.status})") from e


class SpeakIn(BaseModel):
    text: str = Field(min_length=1, max_length=5000)
    language_code: str = Field(default="en-IN", pattern=r"^[a-z]{2}-IN$")
    speaker: str | None = Field(default=None, pattern=r"^[a-z0-9_]{2,60}$")


@router.post("/tts", response_class=Response)
async def text_to_speech(body: SpeakIn, sarvam: Sarvam, _user: User):
    try:
        audio = await sarvam.synthesize(body.text, body.language_code, body.speaker)
    except SarvamError as e:
        raise HTTPException(502, f"Speech service error ({e.status})") from e
    return Response(content=audio, media_type="audio/wav")
