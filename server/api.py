"""
Evida Scribe backend API.

This FastAPI app serves meeting artifacts from `OUTPUT_DIR` (default `./output`) and exposes an
ElevenLabs post-call webhook at `POST /elevenlabs/webhook` that writes new meeting folders into
the same directory.

For free-tier deployments with ephemeral storage, the API also serves a small set of demo meetings
from `seed_data/` so the dashboard isn't empty after restarts.
"""

import hashlib
import hmac
import json
import os
import shutil
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional

from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse

from llm.plan_generator import PlanGenerationError, generate_lifestyle_plan, generate_meeting_title
from models import SessionTranscript, TranscriptUtterance
from utils.io_utils import ensure_output_dir, save_failure_outputs, save_session_outputs


def _iso_from_mtime(path: Path) -> str:
    ts = path.stat().st_mtime
    return datetime.fromtimestamp(ts, tz=timezone.utc).isoformat().replace("+00:00", "Z")


def _read_json(path: Path) -> Optional[Dict[str, Any]]:
    if not path.exists():
        return None
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)


def _snake_to_camel(s: str) -> str:
    parts = s.split("_")
    return parts[0] + "".join(p[:1].upper() + p[1:] for p in parts[1:])


def _convert_plan(plan_snake: Dict[str, Any]) -> Dict[str, Any]:
    out: Dict[str, Any] = {}
    for domain_key, domain_val in (plan_snake or {}).items():
        camel_domain_key = _snake_to_camel(domain_key)
        domain_val = domain_val or {}
        out[camel_domain_key] = {
            "baseline": domain_val.get("baseline", ""),
            "smartGoals": domain_val.get("smart_goals", []) or [],
            "trackingKpis": domain_val.get("tracking_kpis", []) or [],
            "evidenceQuotes": domain_val.get("evidence_quotes", []) or [],
        }
    return out


def _convert_plan_to_snake(plan_camel: Dict[str, Any]) -> Dict[str, Any]:
    """
    Convert frontend plan shape (camelCase keys) to on-disk snake_case JSON.
    """
    out: Dict[str, Any] = {}
    for domain_key, domain_val in (plan_camel or {}).items():
        if not isinstance(domain_val, dict):
            continue
        snake_domain_key = []
        for ch in str(domain_key):
            if ch.isupper():
                snake_domain_key.append("_")
                snake_domain_key.append(ch.lower())
            else:
                snake_domain_key.append(ch)
        snake_key = "".join(snake_domain_key)
        out[snake_key] = {
            "baseline": domain_val.get("baseline", ""),
            "smart_goals": domain_val.get("smartGoals", []) or [],
            "tracking_kpis": domain_val.get("trackingKpis", []) or [],
            "evidence_quotes": domain_val.get("evidenceQuotes", []) or [],
        }
    return out


def _convert_transcript(transcript_snake: Dict[str, Any]) -> Dict[str, Any]:
    utterances = []
    for u in transcript_snake.get("transcript", []) or []:
        utterances.append(
            {
                "speaker": u.get("speaker", "unknown") or "unknown",
                "startTime": u.get("start_time", None),
                "endTime": u.get("end_time", None),
                "text": u.get("text", "") or "",
            }
        )
    return {"rawText": transcript_snake.get("raw_text", "") or "", "utterances": utterances}


def _derive_status(session_dir: Path) -> str:
    if (session_dir / "plan_failure.txt").exists():
        return "failed"
    if (session_dir / "session_plan.json").exists() and (session_dir / "session_transcript.json").exists():
        return "ready"
    if (session_dir / "session_transcript.json").exists():
        return "processing"
    return "failed"


def _read_error_message(session_dir: Path) -> Optional[str]:
    failure_path = session_dir / "plan_failure.txt"
    if not failure_path.exists():
        return None
    try:
        return failure_path.read_text(encoding="utf-8").strip()
    except Exception:
        return "Plan generation failed."


def _output_dir() -> Path:
    return Path(os.getenv("OUTPUT_DIR", "./output"))


def _seed_data_dir() -> Path:
    # Seed data shipped with the repo so the UI isn't empty on ephemeral deployments.
    env_value = os.getenv("SEED_DATA_DIR")
    if env_value:
        return Path(env_value)
    return Path(__file__).resolve().parents[1] / "examples" / "seed_data"


def _load_seed_meetings() -> tuple[list[Dict[str, Any]], dict[str, Dict[str, Any]]]:
    """
    Returns (list_items, detail_by_id) from `seed_data/meetings.json` and/or `seed_data/meetings/*.json`.
    """
    base = _seed_data_dir()
    detail_by_id: dict[str, Dict[str, Any]] = {}
    list_items: list[Dict[str, Any]] = []

    try:
        list_path = base / "meetings.json"
        if list_path.exists():
            with open(list_path, "r", encoding="utf-8") as f:
                parsed = json.load(f)
            if isinstance(parsed, list):
                list_items = parsed
    except Exception:
        list_items = []

    meetings_dir = base / "meetings"
    if meetings_dir.exists() and meetings_dir.is_dir():
        for p in sorted(meetings_dir.glob("*.json")):
            try:
                with open(p, "r", encoding="utf-8") as f:
                    detail = json.load(f)
                meeting_id = detail.get("id") or p.stem
                if meeting_id:
                    detail_by_id[str(meeting_id)] = detail
            except Exception:
                continue

    # If no list file exists, derive a list from the detail files.
    if not list_items and detail_by_id:
        for meeting_id, detail in detail_by_id.items():
            list_items.append(
                {
                    "id": meeting_id,
                    "patientDisplayName": detail.get("patientDisplayName", meeting_id),
                    "createdAt": detail.get("createdAt", _iso_from_mtime(meetings_dir / f"{meeting_id}.json")),
                    "status": detail.get("status", "ready"),
                    "preview": detail.get("preview", ""),
                    "tags": detail.get("tags", []) or [],
                    "hasTranscript": bool(detail.get("hasTranscript", detail.get("transcript") is not None)),
                    "hasPlan": bool(detail.get("hasPlan", detail.get("plan") is not None)),
                }
            )

    return list_items, detail_by_id


def _notes_draft_path() -> Path:
    # Single-user draft notes store. On free-tier deployments this is ephemeral (OUTPUT_DIR=/tmp/output).
    return _output_dir() / "_notes_current.json"


def _load_current_notes() -> str:
    path = _notes_draft_path()
    try:
        if not path.exists():
            return ""
        with open(path, "r", encoding="utf-8") as f:
            data = json.load(f)
        return str(data.get("notes") or "")
    except Exception:
        return ""


def _save_current_notes(notes: str) -> None:
    ensure_output_dir()
    path = _notes_draft_path()
    tmp = path.with_suffix(".tmp")
    with open(tmp, "w", encoding="utf-8") as f:
        json.dump({"notes": notes}, f, indent=2, ensure_ascii=False)
    tmp.replace(path)


def _clear_current_notes() -> None:
    try:
        path = _notes_draft_path()
        if path.exists():
            path.unlink()
    except Exception:
        pass


def _safe_session_dir(base: Path, session_id: str) -> Path:
    base_resolved = base.resolve()
    candidate = (base / session_id).resolve()
    if not str(candidate).startswith(str(base_resolved)):
        raise HTTPException(status_code=400, detail="Invalid meeting id")
    return candidate


app = FastAPI(title="Evida Scribe API", version="0.1.0")

cors_origins = os.getenv("CORS_ORIGINS", "*")
origins = [o.strip() for o in cors_origins.split(",")] if cors_origins else ["*"]
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/healthz")
def healthz():
    return {"ok": True}


@app.get("/api/notes/current")
def get_current_notes():
    return {"notes": _load_current_notes()}


@app.put("/api/notes/current")
async def put_current_notes(request: Request):
    try:
        payload = await request.json()
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid JSON")
    notes = payload.get("notes")
    if notes is None:
        raise HTTPException(status_code=400, detail='Missing field "notes"')
    _save_current_notes(str(notes))
    return {"status": "ok"}


def _webhook_secret() -> Optional[str]:
    return os.getenv("MEETING_PROVIDER_WEBHOOK_SECRET") or os.getenv("ELEVENLABS_WEBHOOK_SECRET")


def _parse_signature_header(signature_header: str) -> tuple[Optional[int], Optional[str]]:
    """
    Expected format similar to: 't=1739537297,v1=abcdef...' (or v0).
    Returns (timestamp, signature_hex) or (None, None) on failure.
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
        sig = v_part.split("=", 1)[1]
        return timestamp, sig
    except Exception:
        return None, None


def _verify_signature(payload: bytes, signature_header: Optional[str]) -> bool:
    secret = _webhook_secret()
    if not secret:
        return True
    if not signature_header:
        return False

    timestamp, signature_hex = _parse_signature_header(signature_header)
    if timestamp is None or signature_hex is None:
        return False

    # Reject stale signatures (30-minute tolerance)
    tolerance_cutoff = int(time.time()) - 30 * 60
    if timestamp < tolerance_cutoff:
        return False

    full_payload = f"{timestamp}.{payload.decode('utf-8', errors='replace')}"
    mac = hmac.new(
        key=secret.encode("utf-8"),
        msg=full_payload.encode("utf-8"),
        digestmod=hashlib.sha256,
    )
    expected = mac.hexdigest()
    signature_hex = signature_hex.removeprefix("v0=").removeprefix("v1=")
    return hmac.compare_digest(expected, signature_hex)


@app.post("/elevenlabs/webhook")
async def elevenlabs_webhook(request: Request):
    """
    Receives ElevenLabs post-call transcript payloads, persists artifacts under OUTPUT_DIR, and
    (optionally) generates a lifestyle plan if OPENAI_API_KEY is configured.
    """
    raw_body = await request.body()
    signature = (
        request.headers.get("Elevenlabs-Signature")
        or request.headers.get("ElevenLabs-Signature")
        or request.headers.get("X-Elevenlabs-Signature")
        or request.headers.get("X-ElevenLabs-Signature")
    )
    if not _verify_signature(raw_body, signature):
        raise HTTPException(status_code=401, detail="Invalid signature")

    try:
        payload = json.loads(raw_body.decode("utf-8"))
    except json.JSONDecodeError:
        raise HTTPException(status_code=400, detail="Invalid JSON payload")

    data = payload.get("data") or {}
    convo_id = data.get("conversation_id") or data.get("id") or "unknown"
    transcript_items = data.get("transcript") or []

    utterances: list[TranscriptUtterance] = []
    for item in transcript_items:
        msg = item.get("message") or item.get("text") or ""
        if not msg:
            continue
        speaker = item.get("role") or item.get("speaker") or "unknown"
        utterances.append(TranscriptUtterance(speaker=speaker, text=msg))

    raw_text = "\n".join(u.text for u in utterances)
    session_transcript = SessionTranscript(session_id=convo_id, raw_text=raw_text, transcript=utterances)

    # Always persist transcript at minimum.
    base = ensure_output_dir()
    session_dir = base / convo_id
    session_dir.mkdir(parents=True, exist_ok=True)
    with open(session_dir / "session_transcript.json", "w", encoding="utf-8") as f:
        json.dump(session_transcript.model_dump(), f, indent=2, ensure_ascii=False)

    # Snapshot the current draft notes and persist them into the session folder.
    notes = _load_current_notes().strip()
    if notes:
        try:
            with open(session_dir / "notes.txt", "w", encoding="utf-8") as f:
                f.write(notes)
        except Exception:
            pass
    _clear_current_notes()

    created_at = datetime.now(tz=timezone.utc).isoformat().replace("+00:00", "Z")
    title = convo_id
    if os.getenv("OPENAI_API_KEY"):
        try:
            title = generate_meeting_title(raw_text, notes=notes)
        except Exception:
            title = convo_id

    # Persist lightweight metadata for list views (safe even on ephemeral storage).
    meta_path = session_dir / "session_meta.json"
    try:
        with open(meta_path, "w", encoding="utf-8") as f:
            json.dump(
                {
                    "createdAt": created_at,
                    "patientDisplayName": title,
                    "tags": [],
                },
                f,
                indent=2,
                ensure_ascii=False,
            )
    except Exception:
        pass

    # Generate plan if possible; if not configured, leave meeting as "processing".
    if not os.getenv("OPENAI_API_KEY"):
        return {"status": "ok", "conversation_id": convo_id, "session_dir": str(session_dir), "plan": "skipped"}

    try:
        plan, _ = generate_lifestyle_plan(session_transcript, notes=notes)
    except PlanGenerationError as exc:
        session_dir = save_failure_outputs(convo_id, session_transcript, exc.raw_response, str(exc))
        return {
            "status": "plan_failed",
            "conversation_id": convo_id,
            "session_dir": str(session_dir),
            "error": str(exc),
        }

    session_dir = save_session_outputs(convo_id, session_transcript, plan)
    return {"status": "ok", "conversation_id": convo_id, "session_dir": str(session_dir)}


@app.get("/api/meetings")
def list_meetings() -> List[Dict[str, Any]]:
    base = _output_dir()

    meetings: List[Dict[str, Any]] = []
    if base.exists():
        for session_dir in sorted([p for p in base.iterdir() if p.is_dir()]):
            session_id = session_dir.name

            meta = _read_json(session_dir / "session_meta.json") or {}
            transcript_raw = _read_json(session_dir / "session_transcript.json")
            plan_raw = _read_json(session_dir / "session_plan.json")

            created_at = meta.get("createdAt") or meta.get("created_at") or _iso_from_mtime(session_dir)
            patient_display_name = meta.get("patientDisplayName") or meta.get("patient_display_name") or session_id
            tags = meta.get("tags") or []

            preview_source = ""
            if transcript_raw:
                preview_source = (transcript_raw.get("raw_text") or "").strip()
            preview = (preview_source[:180] + "…") if len(preview_source) > 180 else preview_source

            meetings.append(
                {
                    "id": session_id,
                    "patientDisplayName": patient_display_name,
                    "createdAt": created_at,
                    "status": meta.get("status") or _derive_status(session_dir),
                    "preview": preview,
                    "tags": tags,
                    "hasTranscript": transcript_raw is not None,
                    "hasPlan": plan_raw is not None,
                }
            )

    seed_list, _seed_detail_by_id = _load_seed_meetings()
    existing_ids = {m.get("id") for m in meetings if m.get("id")}
    for item in seed_list:
        item_id = item.get("id")
        if item_id and item_id not in existing_ids:
            meetings.append(item)

    meetings.sort(key=lambda m: m.get("createdAt") or "", reverse=True)
    return meetings


@app.get("/api/meetings/{meeting_id}")
def get_meeting(meeting_id: str) -> Dict[str, Any]:
    base = _output_dir()
    session_dir = _safe_session_dir(base, meeting_id)
    if not session_dir.exists() or not session_dir.is_dir():
        seed_list, seed_detail_by_id = _load_seed_meetings()
        seed = seed_detail_by_id.get(meeting_id)
        if seed:
            return seed
        # Allow lookup by list id even if only list exists.
        if any(m.get("id") == meeting_id for m in seed_list):
            raise HTTPException(status_code=404, detail="Seed meeting detail missing")
        raise HTTPException(status_code=404, detail="Meeting not found")

    meta = _read_json(session_dir / "session_meta.json") or {}
    transcript_raw = _read_json(session_dir / "session_transcript.json")
    plan_raw = _read_json(session_dir / "session_plan.json")

    created_at = meta.get("createdAt") or meta.get("created_at") or _iso_from_mtime(session_dir)
    patient_display_name = meta.get("patientDisplayName") or meta.get("patient_display_name") or meeting_id
    tags = meta.get("tags") or []

    preview_source = ""
    if transcript_raw:
        preview_source = (transcript_raw.get("raw_text") or "").strip()
    preview = (preview_source[:180] + "…") if len(preview_source) > 180 else preview_source

    detail: Dict[str, Any] = {
        "id": meeting_id,
        "patientDisplayName": patient_display_name,
        "createdAt": created_at,
        "status": meta.get("status") or _derive_status(session_dir),
        "preview": preview,
        "tags": tags,
        "hasTranscript": transcript_raw is not None,
        "hasPlan": plan_raw is not None,
    }

    if transcript_raw:
        detail["transcript"] = _convert_transcript(transcript_raw)
    if plan_raw:
        detail["plan"] = _convert_plan(plan_raw)
    err = _read_error_message(session_dir)
    if err:
        detail["errorMessage"] = err

    return detail


@app.get("/api/meetings/{meeting_id}/artifacts/{artifact_name}")
def get_artifact(meeting_id: str, artifact_name: str):
    """
    Download an artifact file for a meeting.

    Intended for convenience (e.g., download the plan markdown) in the hosted frontend.
    """
    allowed = {
        "session_transcript.json",
        "session_plan.json",
        "session_plan.md",
        "plan_failure.txt",
        "session_meta.json",
    }
    if artifact_name not in allowed:
        raise HTTPException(status_code=404, detail="Artifact not found")

    base = _output_dir()
    session_dir = _safe_session_dir(base, meeting_id)
    path = session_dir / artifact_name
    if not path.exists():
        raise HTTPException(status_code=404, detail="Artifact not found")

    return FileResponse(path)


@app.delete("/api/meetings/{meeting_id}")
def delete_meeting(meeting_id: str):
    """
    Delete a meeting's on-disk artifacts under OUTPUT_DIR/<meeting_id>/.

    This only affects the live OUTPUT_DIR store (seed meetings shipped in `seed_data/` are not deleted).
    """
    base = _output_dir()
    session_dir = _safe_session_dir(base, meeting_id)
    if not session_dir.exists() or not session_dir.is_dir():
        raise HTTPException(status_code=404, detail="Meeting not found")

    try:
        shutil.rmtree(session_dir)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Failed to delete meeting: {exc}")

    return {"status": "deleted", "id": meeting_id}


@app.put("/api/meetings/{meeting_id}/plan")
async def update_meeting_plan(meeting_id: str, request: Request):
    """
    Update a meeting plan (session_plan.json + session_plan.md) for OUTPUT_DIR/<meeting_id>/.
    """
    base = _output_dir()
    session_dir = _safe_session_dir(base, meeting_id)
    if not session_dir.exists() or not session_dir.is_dir():
        raise HTTPException(status_code=404, detail="Meeting not found")

    try:
        payload = await request.json()
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid JSON")

    plan = payload.get("plan") if isinstance(payload, dict) else None
    if not isinstance(plan, dict):
        raise HTTPException(status_code=400, detail='Missing field "plan"')

    plan_snake = _convert_plan_to_snake(plan)

    plan_json_path = session_dir / "session_plan.json"
    with open(plan_json_path, "w", encoding="utf-8") as f:
        json.dump(plan_snake, f, indent=2, ensure_ascii=False)

    # Regenerate markdown from snake_case plan shape to match existing artifact naming.
    md_path = session_dir / "session_plan.md"
    with open(md_path, "w", encoding="utf-8") as f:
        f.write(f"# Lifestyle Plan for session {meeting_id}\n\n")
        for domain_name, domain in plan_snake.items():
            title = domain_name.replace("_", " ").title()
            f.write(f"## {title}\n\n")
            f.write(f"**Baseline**\n\n{domain.get('baseline','')}\n\n")
            f.write("**SMART Goals**\n\n")
            for goal in domain.get("smart_goals", []) or []:
                f.write(f"- {goal}\n")
            f.write("\n**Tracking KPIs**\n\n")
            for kpi in domain.get("tracking_kpis", []) or []:
                f.write(f"- {kpi}\n")
            f.write("\n\n")

    return {"status": "ok"}
