from contextlib import asynccontextmanager

import httpx
import structlog
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import get_settings
from app.routes import voice
from app.sarvam import SarvamClient

log = structlog.get_logger()


@asynccontextmanager
async def lifespan(app: FastAPI):
    settings = get_settings()
    async with httpx.AsyncClient(timeout=httpx.Timeout(30.0)) as http:
        app.state.sarvam = SarvamClient(settings, http)
        log.info("started", environment=settings.environment)
        yield


def create_app() -> FastAPI:
    settings = get_settings()
    app = FastAPI(title="Taskora API", lifespan=lifespan)
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_methods=["GET", "POST"],
        allow_headers=["authorization", "content-type"],
    )
    app.include_router(voice.router)

    @app.get("/health")
    async def health():
        return {"ok": True}

    return app


app = create_app()
