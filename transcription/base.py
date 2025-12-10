from abc import ABC, abstractmethod

from models import SessionTranscript


class TranscriptionProvider(ABC):
    @abstractmethod
    def transcribe_audio(self, audio_bytes: bytes, session_id: str) -> SessionTranscript:
        """Return a SessionTranscript for the given audio bytes."""
        raise NotImplementedError
