from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    environment: str = "development"

    sarvam_api_key: str
    sarvam_base_url: str = "https://api.sarvam.ai"
    # Model ids live here only, so a Sarvam model change is a one-line edit.
    stt_model: str = "saaras:v4"
    stt_mode: str = "codemix"
    tts_model: str = "bulbul:v4-flash"
    tts_default_speaker: str = "simran_en_customer"
    tts_sample_rate: int = 24000

    # Clerk: verify session JWTs. Without CLERK_JWKS_URL, auth is skipped in development only.
    clerk_jwks_url: str | None = None
    clerk_issuer: str | None = None

    cors_origins: list[str] = [
        "http://localhost:3000",
        "https://taskora-kappa-seven.vercel.app",
    ]

    max_audio_bytes: int = 5 * 1024 * 1024
    voice_requests_per_minute: int = 30


@lru_cache
def get_settings() -> Settings:
    return Settings()  # type: ignore[call-arg]
