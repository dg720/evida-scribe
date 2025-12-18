import os
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse


def _iso_from_mtime(path: Path) -> str:
    ts = path.stat().st_mtime
    return datetime.fromtimestamp(ts, tz=timezone.utc).isoformat().replace("+00:00", "Z")


def _read_json(path: Path) -> Optional[Dict[str, Any]]:
    if not path.exists():
        return None
    import json

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


@app.get("/api/meetings")
def list_meetings() -> List[Dict[str, Any]]:
    base = _output_dir()
    if not base.exists():
        return []

    meetings: List[Dict[str, Any]] = []
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

    meetings.sort(key=lambda m: m.get("createdAt") or "", reverse=True)
    return meetings


@app.get("/api/meetings/{meeting_id}")
def get_meeting(meeting_id: str) -> Dict[str, Any]:
    base = _output_dir()
    session_dir = _safe_session_dir(base, meeting_id)
    if not session_dir.exists() or not session_dir.is_dir():
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
