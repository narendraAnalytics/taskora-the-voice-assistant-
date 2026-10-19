import json
import re
from typing import Annotated, Literal

import structlog
from fastapi import APIRouter, Depends, File, Form, HTTPException, Request, UploadFile
from fastapi.responses import Response
from pydantic import BaseModel, Field

from app.auth import rate_limit
from app.config import Settings, get_settings
from app.sarvam import SarvamClient, SarvamError

log = structlog.get_logger()
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
        log.warning("sarvam_stt_failed", status=e.status, detail=e.detail)
        raise HTTPException(502, f"Speech service error ({e.status})") from e


class SpeakIn(BaseModel):
    text: str = Field(min_length=1, max_length=5000)
    language_code: str = Field(default="en-IN", pattern=r"^[a-z]{2}-IN$")
    speaker: str | None = Field(default=None, pattern=r"^[a-z0-9_]{2,60}$")
    # mp3 is ~3x smaller than wav, so replies reach the browser sooner.
    codec: Literal["wav", "mp3"] = "wav"


@router.post("/tts", response_class=Response)
async def text_to_speech(body: SpeakIn, sarvam: Sarvam, _user: User):
    try:
        audio = await sarvam.synthesize(body.text, body.language_code, body.speaker, body.codec)
    except SarvamError as e:
        log.warning("sarvam_tts_failed", status=e.status, detail=e.detail)
        raise HTTPException(502, f"Speech service error ({e.status})") from e
    return Response(content=audio, media_type="audio/mpeg" if body.codec == "mp3" else "audio/wav")


TASK_PROMPT = """You turn an organizer's spoken sentence into a task assignment for an intern batch.
Today is {today} ({weekday}), India time. Answer with ONE JSON object and nothing else:
{{"action": "assign_task" | "other",
  "person": string | null,   // the intern's name exactly as spoken, e.g. "Ravi"
  "title": string | null,    // short task title, e.g. "Login page"
  "due": "YYYY-MM-DD" | null,// deadline as a calendar date, resolved from today
  "send_email": true | false | null}} // true only if they asked to email/mail/notify the intern
Rules:
- "assign_task" when they give or assign work to someone. Otherwise "other" with every other field null.
- A "draft" holds what was already collected. Keep its values unless the new sentence changes them, and
  fill the gaps from the new sentence (for example a reply of just "Friday" fills the deadline).
- "Friday"/"next Friday"/"tomorrow"/"in 3 days"/"end of the week" must become a real date after today. If
  no deadline is said, due stays null. Never invent a deadline, a person or a title.
- Interns on the batch: {names}. Use the spoken name; do not pick between two people with the same first name.
- Titles are short noun phrases; drop filler like "please", "task to", the person's name and the date.
"""

DATE = re.compile(r"^\d{4}-\d{2}-\d{2}$")


class Draft(BaseModel):
    person: str | None = Field(default=None, max_length=80)
    title: str | None = Field(default=None, max_length=120)
    due: str | None = Field(default=None, max_length=10)
    send_email: bool | None = None


class IntentIn(BaseModel):
    text: str = Field(min_length=1, max_length=600)
    today: str = Field(pattern=r"^\d{4}-\d{2}-\d{2}$")
    weekday: str = Field(max_length=12)
    interns: list[str] = Field(default_factory=list, max_length=60)
    draft: Draft | None = None


class IntentOut(Draft):
    action: Literal["assign_task", "other"] = "other"


def _clean(value: object, limit: int) -> str | None:
    return value.strip()[:limit] if isinstance(value, str) and value.strip() else None


@router.post("/intent", response_model=IntentOut)
async def intent(body: IntentIn, sarvam: Sarvam, _user: User):
    system = TASK_PROMPT.format(today=body.today, weekday=body.weekday, names=", ".join(body.interns[:60]) or "none")
    user = json.dumps({"draft": body.draft.model_dump() if body.draft else None, "sentence": body.text})
    try:
        raw = await sarvam.chat_json(system, user)
    except SarvamError as e:
        log.warning("sarvam_intent_failed", status=e.status, detail=e.detail)
        raise HTTPException(502, f"Language service error ({e.status})") from e
    due = _clean(raw.get("due"), 10)
    send_email = raw.get("send_email")
    return IntentOut(
        action="assign_task" if raw.get("action") == "assign_task" else "other",
        person=_clean(raw.get("person"), 80),
        title=_clean(raw.get("title"), 120),
        # A date the model got wrong shape-wise, or one before today, counts as "no deadline said".
        due=due if due and DATE.match(due) and due >= body.today else None,
        send_email=send_email if isinstance(send_email, bool) else None,
    )
