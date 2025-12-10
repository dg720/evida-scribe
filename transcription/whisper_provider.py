from openai import OpenAI

from config import settings
from models import SessionTranscript, TranscriptUtterance
from transcription.base import TranscriptionProvider
from utils.logging_utils import get_logger

logger = get_logger(__name__)


class WhisperProvider(TranscriptionProvider):
    def __init__(self, api_key: str, model_name: str):
        self.client = OpenAI(api_key=api_key)
        self.model_name = model_name

    def transcribe_audio(self, audio_bytes: bytes, session_id: str) -> SessionTranscript:
        logger.info("Transcribing audio via Whisper for session %s", session_id)
        resp = self.client.audio.transcriptions.create(
            model=self.model_name, file=("session.wav", audio_bytes)
        )
        text = resp.text
        utterance = TranscriptUtterance(speaker="unknown", text=text)
        return SessionTranscript(session_id=session_id, raw_text=text, transcript=[utterance])
