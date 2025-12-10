import hashlib
import hmac
import json
import time
from typing import Optional, Tuple

from fastapi import FastAPI, HTTPException, Request

from config import settings
from llm.plan_generator import PlanGenerationError, generate_lifestyle_plan
from models import SessionTranscript, TranscriptUtterance
from utils.io_utils import save_failure_outputs, save_session_outputs
from utils.logging_utils import get_logger

app = FastAPI()
logger = get_logger(__name__)

WEBHOOK_SECRET = settings.meeting_provider_webhook_secret


def _parse_signature_header(signature_header: str) -> Tuple[Optional[int], Optional[str]]:
    """
    Expected format similar to: 't=1739537297,v1=abcdef...' (or v0)
    Returns (timestamp, signature) or (None, None) on failure.
    """
    try:
        parts = [p.strip() for p in signature_header.split(",")]
        t_part = next((p for p in parts if p.startswith("t=")), None)
        v_part = next((p for p in parts if p.startswith("v1=")), None) or next(
            (p for p in parts if p.startswith("v0=")), None
        )
        if not t_part or not v_part:
            return None, None
        timestamp = int(t_part.split("=", 1)[1])
        v0_sig = v_part.split("=", 1)[1]
        return timestamp, v0_sig
    except Exception:
        return None, None


def verify_signature(payload: bytes, signature_header: Optional[str]) -> bool:
    if not WEBHOOK_SECRET:
        # No secret configured; skip verification.
        return True
    if not signature_header:
        return False

    timestamp, v0_sig = _parse_signature_header(signature_header)
    if timestamp is None or v0_sig is None:
        logger.error("Signature header missing expected t= or v0/v1= parts: %s", signature_header)
        return False

    # Reject stale signatures (30-minute tolerance)
    tolerance_cutoff = int(time.time()) - 30 * 60
    if timestamp < tolerance_cutoff:
        logger.error("Signature timestamp too old: %s (cutoff %s)", timestamp, tolerance_cutoff)
        return False

    full_payload = f"{timestamp}.{payload.decode('utf-8')}"
    mac = hmac.new(
        key=WEBHOOK_SECRET.encode("utf-8"),
        msg=full_payload.encode("utf-8"),
        digestmod=hashlib.sha256,
    )
    digest = "v0=" + mac.hexdigest()
    if not hmac.compare_digest(digest, v0_sig):
        logger.error("Signature mismatch: expected %s computed %s", v0_sig, digest)
        return False
    return True


@app.post("/elevenlabs/webhook")
async def elevenlabs_webhook(request: Request):
    raw_body = await request.body()
    signature = (
        request.headers.get("Elevenlabs-Signature")
        or request.headers.get("ElevenLabs-Signature")
        or request.headers.get("X-Elevenlabs-Signature")
        or request.headers.get("X-ElevenLabs-Signature")
    )
    if not verify_signature(raw_body, signature):
        logger.error(
            "Invalid or missing ElevenLabs signature header; check webhook secret configuration. Header: %s",
            signature,
        )
        raise HTTPException(status_code=401, detail="Invalid signature")

    try:
        payload = json.loads(raw_body.decode("utf-8"))
    except json.JSONDecodeError:
        raise HTTPException(status_code=400, detail="Invalid JSON payload")

    data = payload.get("data") or {}
    convo_id = data.get("conversation_id") or data.get("id") or "unknown"
    transcript_items = data.get("transcript") or []

    utterances = []
    for item in transcript_items:
        msg = item.get("message") or item.get("text") or ""
        if not msg:
            continue
        speaker = item.get("role") or item.get("speaker") or "unknown"
        utterances.append(TranscriptUtterance(speaker=speaker, text=msg))

    raw_text = "\n".join(u.text for u in utterances)
    session_transcript = SessionTranscript(session_id=convo_id, raw_text=raw_text, transcript=utterances)

    try:
        plan, _ = generate_lifestyle_plan(session_transcript, notes="")
    except PlanGenerationError as exc:
        session_dir = save_failure_outputs(convo_id, session_transcript, exc.raw_response, str(exc))
        logger.error("Plan generation failed for conversation %s: %s", convo_id, exc)
        return {
            "status": "plan_failed",
            "conversation_id": convo_id,
            "session_dir": str(session_dir),
            "error": str(exc),
        }

    session_dir = save_session_outputs(convo_id, session_transcript, plan)
    logger.info("Processed ElevenLabs transcript for %s", convo_id)
    return {"status": "ok", "conversation_id": convo_id, "session_dir": str(session_dir)}
