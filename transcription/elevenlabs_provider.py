from typing import List

import requests

from models import SessionTranscript, TranscriptUtterance
from transcription.base import TranscriptionProvider
from utils.logging_utils import get_logger

logger = get_logger(__name__)


class ElevenLabsProvider(TranscriptionProvider):
    def __init__(self, api_key: str, model_name: str):
        self.api_key = api_key
        self.model_name = model_name
        self.base_url = "https://api.elevenlabs.io/v1/speech-to-text"

    def transcribe_audio(self, audio_bytes: bytes, session_id: str) -> SessionTranscript:
        logger.info("Transcribing audio via ElevenLabs for session %s", session_id)
        headers = {"xi-api-key": self.api_key}
        files = {"file": ("session.wav", audio_bytes, "application/octet-stream")}
        data = {
            "model_id": self.model_name,  # ElevenLabs expects model_id
            "diarize": "true",
            "language": "en",
        }

        response = requests.post(self.base_url, headers=headers, files=files, data=data, timeout=120)
        try:
            response.raise_for_status()
        except requests.HTTPError as exc:
            logger.error(
                "ElevenLabs transcription failed (status %s): %s",
                response.status_code,
                response.text,
            )
            raise exc
        result = response.json()

        transcript_items = result.get("transcript") or result.get("segments") or []
        utterances: List[TranscriptUtterance] = []
        raw_parts: List[str] = []

        for item in transcript_items:
            speaker = item.get("speaker") or item.get("speaker_label") or "unknown"
            text = item.get("text") or ""
            if not text:
                continue
            utterances.append(TranscriptUtterance(speaker=speaker, text=text))
            raw_parts.append(text)

        if not utterances:
            fallback_text = result.get("text") or result.get("transcript_text") or ""
            if fallback_text:
                utterances.append(TranscriptUtterance(speaker="unknown", text=fallback_text))
                raw_parts.append(fallback_text)

        raw_text = "\n".join(raw_parts).strip()
        return SessionTranscript(session_id=session_id, raw_text=raw_text, transcript=utterances)
