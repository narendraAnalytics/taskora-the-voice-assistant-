import time
from collections import defaultdict, deque
from typing import Annotated

import jwt
from fastapi import Depends, HTTPException, Request

from app.config import Settings, get_settings

_jwks: dict[str, jwt.PyJWKClient] = {}


def _verify(token: str, settings: Settings) -> dict:
    assert settings.clerk_jwks_url
    client = _jwks.setdefault(settings.clerk_jwks_url, jwt.PyJWKClient(settings.clerk_jwks_url))
    key = client.get_signing_key_from_jwt(token).key
    return jwt.decode(
        token,
        key,
        algorithms=["RS256"],
        issuer=settings.clerk_issuer,
        options={"verify_aud": False, "verify_iss": bool(settings.clerk_issuer)},
    )


def current_user(request: Request, settings: Annotated[Settings, Depends(get_settings)]) -> str:
    """Returns the Clerk user id. Fails closed outside development."""
    if not settings.clerk_jwks_url:
        if settings.environment == "development":
            return "dev-user"
        raise HTTPException(500, "Auth is not configured")
    header = request.headers.get("authorization", "")
    if not header.lower().startswith("bearer "):
        raise HTTPException(401, "Missing bearer token")
    try:
        claims = _verify(header[7:], settings)
    except jwt.PyJWTError:
        raise HTTPException(401, "Invalid token") from None
    return claims["sub"]


_hits: dict[str, deque[float]] = defaultdict(deque)


def rate_limit(
    user: Annotated[str, Depends(current_user)],
    settings: Annotated[Settings, Depends(get_settings)],
) -> str:
    """Per-user sliding window; protects the Sarvam bill. In-memory: single instance only."""
    now = time.monotonic()
    q = _hits[user]
    while q and now - q[0] > 60:
        q.popleft()
    if len(q) >= settings.voice_requests_per_minute:
        raise HTTPException(429, "Too many voice requests, slow down")
    q.append(now)
    return user
