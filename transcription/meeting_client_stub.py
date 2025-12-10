from models import SessionTranscript


class MeetingTranscriptClientStub:
    """
    Stub / placeholder for a future meeting transcription provider
    (e.g. Granola, Zoom, or others).

    This is NOT implemented because a suitable public API is not available.
    """

    def fetch_transcript(self, conversation_id: str) -> SessionTranscript:
        """
        Placeholder method. For now, raise NotImplementedError.
        """
        raise NotImplementedError("Meeting provider integration is not implemented.")
