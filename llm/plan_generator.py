import json
import os
from typing import Tuple

from dotenv import load_dotenv
from openai import OpenAI

from config import settings
from models import LifestylePlan, SessionTranscript
from utils.logging_utils import get_logger

logger = get_logger(__name__)

# Allow direct env loading alongside settings for flexibility.
load_dotenv()
OPENAI_API_KEY = settings.openai_api_key or os.getenv("OPENAI_API_KEY")
client = OpenAI(api_key=OPENAI_API_KEY)

PROMPT_TEMPLATE = """
You are a health coaching documentation assistant.

You will receive:
1) A transcript of a non-clinical health coaching session between a coach and a client.
2) Optional notes about the client.

Your job is to produce a structured lifestyle plan with the following domains:
- healthy_eating
- physical_activity
- substances
- stress_management
- sleep
- social_connections

For each domain, extract:
- "baseline": 1-3 sentences summarising the client's current situation.
- "smart_goals": a list of 1-3 SMART goals, phrased concretely and, where possible, in the client's tone.
- "tracking_kpis": a list of 2-5 measurable indicators (e.g. steps per day, alcohol units per week, bedtime consistency).

Use only information present or strongly implied in the transcript and notes. Do NOT invent or hallucinate.
If there is not enough information for a domain:
- set "baseline" to a short statement that information is incomplete,
- set "smart_goals": [],
- set "tracking_kpis": [].

Return ONLY valid JSON with this structure:

{
  "healthy_eating": {
    "baseline": "...",
    "smart_goals": ["..."],
    "tracking_kpis": ["..."]
  },
  "physical_activity": { ... },
  "substances": { ... },
  "stress_management": { ... },
  "sleep": { ... },
  "social_connections": { ... }
}

----

TRANSCRIPT:
<<TRANSCRIPT_TEXT>>

NOTES:
<<NOTES_TEXT>>
"""


class PlanGenerationError(Exception):
    def __init__(self, message: str, raw_response: str | None = None):
        super().__init__(message)
        self.raw_response = raw_response


def generate_lifestyle_plan(transcript: SessionTranscript, notes: str) -> Tuple[LifestylePlan, str]:
    transcript_text = transcript.raw_text
    prompt = (
        PROMPT_TEMPLATE.replace("<<TRANSCRIPT_TEXT>>", transcript_text or "")
        .replace("<<NOTES_TEXT>>", notes or "")
    )

    logger.info(
        "Generating lifestyle plan for session %s (transcript_chars=%s, notes_chars=%s)",
        transcript.session_id,
        len(transcript_text or ""),
        len(notes or ""),
    )
    try:
        response = client.responses.create(
            model=settings.openai_llm_model,
            input=prompt,
            response_format={"type": "json_object"},
        )
        raw_json = response.output[0].content[0].text
    except TypeError:
        # Fallback for older openai python versions without responses API
        chat_resp = client.chat.completions.create(
            model=settings.openai_llm_model,
            messages=[
                {"role": "system", "content": "You are a JSON-only responder. Reply with JSON."},
                {"role": "user", "content": prompt},
            ],
            response_format={"type": "json_object"},
        )
        raw_json = chat_resp.choices[0].message.content  # type: ignore[attr-defined]
    logger.info("LLM raw JSON length: %s", len(raw_json or ""))

    try:
        data = json.loads(raw_json)
    except json.JSONDecodeError as exc:
        logger.error("Failed to parse LLM JSON: %s", exc)
        raise PlanGenerationError("Failed to parse LLM response", raw_response=raw_json) from exc

    try:
        plan = LifestylePlan(**data)
    except Exception as exc:
        logger.error("Failed to validate LLM JSON against schema: %s", exc)
        raise PlanGenerationError("LLM response did not match schema", raw_response=raw_json) from exc

    return plan, raw_json
