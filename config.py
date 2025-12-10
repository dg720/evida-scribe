from typing import Optional

import pydantic
from dotenv import load_dotenv

try:
    from pydantic_settings import BaseSettings, SettingsConfigDict
    from pydantic import Field, ValidationError
    _PydanticV1 = False
except ImportError:
    from pydantic import BaseSettings, Field, ValidationError  # type: ignore

    if getattr(pydantic, "__version__", "1").startswith("2."):
        raise RuntimeError(
            "pydantic-settings is required when using pydantic v2. "
            "Install it with `pip install pydantic-settings`."
        )
    _PydanticV1 = True
    SettingsConfigDict = None  # type: ignore

# Load environment variables from a local .env file if present
load_dotenv()


class Settings(BaseSettings):
    openai_api_key: str = Field(..., env="OPENAI_API_KEY")
    elevenlabs_api_key: Optional[str] = Field(default=None, env="ELEVENLABS_API_KEY")

    openai_transcribe_model: str = Field(
        default="gpt-4o-mini-transcribe", env="OPENAI_TRANSCRIBE_MODEL"
    )
    openai_llm_model: str = Field(default="gpt-4.1-mini", env="OPENAI_LLM_MODEL")
    elevenlabs_stt_model: str = Field(default="scribe_v2", env="ELEVENLABS_STT_MODEL")

    default_transcription_provider: str = Field(
        default="whisper", env="DEFAULT_TRANSCRIPTION_PROVIDER"
    )
    output_dir: str = Field(default="./output", env="OUTPUT_DIR")

    meeting_provider_base_url: Optional[str] = Field(
        default=None, env="MEETING_PROVIDER_BASE_URL"
    )
    meeting_provider_api_key: Optional[str] = Field(
        default=None, env="MEETING_PROVIDER_API_KEY"
    )
    meeting_provider_webhook_secret: Optional[str] = Field(
        default=None, env="MEETING_PROVIDER_WEBHOOK_SECRET"
    )

    if not _PydanticV1:
        model_config = SettingsConfigDict(env_file=".env", extra="ignore")  # type: ignore
    else:
        class Config:
            env_file = ".env"
            extra = "ignore"


try:
    settings = Settings()  # type: ignore
except ValidationError as exc:
    missing_keys = [err["loc"][0] for err in exc.errors()]
    raise RuntimeError(f"Missing required environment variables: {missing_keys}") from exc

if not settings.openai_api_key:
    raise RuntimeError("OPENAI_API_KEY is required for the prototype to run.")
