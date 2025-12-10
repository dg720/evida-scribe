from pathlib import Path
from typing import Optional

import typer

from config import settings
from llm.plan_generator import PlanGenerationError, generate_lifestyle_plan
from transcription.elevenlabs_provider import ElevenLabsProvider
from transcription.whisper_provider import WhisperProvider
from utils.io_utils import save_failure_outputs, save_session_outputs
from utils.logging_utils import get_logger

logger = get_logger(__name__)

app = typer.Typer(help="Evida coaching pipeline prototype (CLI only).")


def _load_audio_bytes(audio_path: Path) -> bytes:
    with open(audio_path, "rb") as f:
        return f.read()


def _load_notes(notes_path: Optional[Path]) -> str:
    if not notes_path:
        return ""
    with open(notes_path, "r", encoding="utf-8") as f:
        return f.read()


def _load_transcript_json(transcript_path: Path):
    import json

    from models import SessionTranscript

    with open(transcript_path, "r", encoding="utf-8") as f:
        data = json.load(f)
    return SessionTranscript(**data)


def _choose_provider(name: str):
    provider = name.lower()
    if provider == "whisper":
        return WhisperProvider(api_key=settings.openai_api_key, model_name=settings.openai_transcribe_model)
    if provider == "elevenlabs":
        if not settings.elevenlabs_api_key:
            raise typer.BadParameter("ELEVENLABS_API_KEY is required to use ElevenLabs STT.")
        return ElevenLabsProvider(api_key=settings.elevenlabs_api_key, model_name=settings.elevenlabs_stt_model)
    raise typer.BadParameter("Provider must be one of: whisper, elevenlabs.")


@app.command("process-local-audio")
def process_local_audio(
    audio_path: Path = typer.Option(..., exists=True, file_okay=True, dir_okay=False, readable=True),
    notes_path: Optional[Path] = typer.Option(None, exists=True, file_okay=True, dir_okay=False, readable=True),
    provider: Optional[str] = typer.Option(None, help='Transcription provider: "whisper" or "elevenlabs".'),
    session_id: Optional[str] = typer.Option(None, help="Optional session identifier; defaults to audio filename stem."),
    transcript_path: Optional[Path] = typer.Option(
        None,
        exists=True,
        file_okay=True,
        dir_okay=False,
        readable=True,
        help="Optional path to a pre-generated transcript JSON to skip speech-to-text.",
    ),
):
    """
    Transcribe a local audio file, generate a lifestyle plan, and persist outputs to disk.
    """
    chosen_provider = provider or settings.default_transcription_provider
    session_identifier = session_id or audio_path.stem

    typer.echo(f"[info] session_id={session_identifier}")
    typer.echo(f"[info] provider={chosen_provider} (ignored if transcript_path is provided)")
    typer.echo(f"[info] notes={'provided' if notes_path else 'none'}")
    typer.echo(f"[info] transcript_source={'file' if transcript_path else 'stt'}")

    audio_bytes = _load_audio_bytes(audio_path)
    notes_text = _load_notes(notes_path)

    if transcript_path:
        transcript = _load_transcript_json(transcript_path)
        logger.info("Loaded existing transcript from %s", transcript_path)
    else:
        transcription_provider = _choose_provider(chosen_provider)
        try:
            transcript = transcription_provider.transcribe_audio(audio_bytes, session_identifier)
        except Exception as exc:
            logger.error("Transcription failed: %s", exc)
            raise typer.Exit(code=1)
        logger.info("Transcription completed for session %s", session_identifier)

    try:
        plan, raw_json = generate_lifestyle_plan(transcript, notes_text)
    except PlanGenerationError as exc:
        logger.error("Plan generation failed: %s", exc)
        session_dir = save_failure_outputs(
            session_identifier, transcript, raw_response=exc.raw_response, error_message=str(exc)
        )
        typer.echo(f"Transcription saved, but plan generation failed. See: {session_dir}")
        raise typer.Exit(code=1)
    else:
        session_dir = save_session_outputs(session_identifier, transcript, plan)
        typer.echo(f"Session artifacts written to: {session_dir}")


@app.command("process-meeting-transcript")
def process_meeting_transcript(conversation_id: str = typer.Option(..., help="Conversation identifier")):
    """
    Stub only: meeting provider integration is not implemented.
    """
    logger.warning("Meeting provider integration is not implemented. This is a stub.")
    raise typer.Exit(code=1)


if __name__ == "__main__":
    app()
