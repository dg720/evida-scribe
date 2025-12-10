from typing import List, Optional

from pydantic import BaseModel


class Domain(BaseModel):
    baseline: str
    smart_goals: List[str]
    tracking_kpis: List[str]
    evidence_quotes: Optional[List[str]] = []


class LifestylePlan(BaseModel):
    healthy_eating: Domain
    physical_activity: Domain
    substances: Domain
    stress_management: Domain
    sleep: Domain
    social_connections: Domain


class TranscriptUtterance(BaseModel):
    speaker: str
    start_time: Optional[float] = None
    end_time: Optional[float] = None
    text: str


class SessionTranscript(BaseModel):
    session_id: str
    raw_text: str
    transcript: List[TranscriptUtterance]
