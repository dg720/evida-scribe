"""
Export frontend-friendly JSON from on-disk session artifacts.

This script is intentionally stdlib-only so it can run in minimal environments
without installing the full Python dependencies.

Usage:
  python scripts/export_frontend_data.py --source ./output --out ./frontend_data
"""

import argparse
import json
import os
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional


def iso_from_mtime(path: Path) -> str:
    ts = path.stat().st_mtime
    return datetime.fromtimestamp(ts, tz=timezone.utc).isoformat().replace("+00:00", "Z")


def read_json(path: Path) -> Optional[Dict[str, Any]]:
    if not path.exists():
        return None
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)


def snake_to_camel(s: str) -> str:
    parts = s.split("_")
    return parts[0] + "".join(p[:1].upper() + p[1:] for p in parts[1:])


def convert_plan(plan_snake: Dict[str, Any]) -> Dict[str, Any]:
    out: Dict[str, Any] = {}
    for domain_key, domain_val in (plan_snake or {}).items():
        camel_domain_key = snake_to_camel(domain_key)
        domain_val = domain_val or {}
        out[camel_domain_key] = {
            "baseline": domain_val.get("baseline", ""),
            "smartGoals": domain_val.get("smart_goals", []) or [],
            "trackingKpis": domain_val.get("tracking_kpis", []) or [],
            "evidenceQuotes": domain_val.get("evidence_quotes", []) or [],
        }
    return out


def convert_transcript(transcript_snake: Dict[str, Any]) -> Dict[str, Any]:
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


def derive_status(session_dir: Path) -> str:
    if (session_dir / "plan_failure.txt").exists():
        return "failed"
    if (session_dir / "session_plan.json").exists() and (session_dir / "session_transcript.json").exists():
        return "ready"
    if (session_dir / "session_transcript.json").exists():
        return "processing"
    return "failed"


def read_error_message(session_dir: Path) -> Optional[str]:
    path = session_dir / "plan_failure.txt"
    if not path.exists():
        return None
    try:
        return path.read_text(encoding="utf-8").strip()
    except Exception:
        return "Plan generation failed."


def export_frontend_data(source: Path, out: Path) -> int:
    out.mkdir(parents=True, exist_ok=True)
    (out / "meetings").mkdir(parents=True, exist_ok=True)

    meetings_list: List[Dict[str, Any]] = []
    if not source.exists():
        with open(out / "meetings.json", "w", encoding="utf-8") as f:
            json.dump([], f, indent=2, ensure_ascii=False)
        return 0

    for session_dir in sorted([p for p in source.iterdir() if p.is_dir()]):
        session_id = session_dir.name
        meta = read_json(session_dir / "session_meta.json") or {}
        transcript_raw = read_json(session_dir / "session_transcript.json")
        plan_raw = read_json(session_dir / "session_plan.json")

        created_at = meta.get("createdAt") or meta.get("created_at") or iso_from_mtime(session_dir)
        patient_display_name = meta.get("patientDisplayName") or meta.get("patient_display_name") or session_id
        tags = meta.get("tags") or []

        has_transcript = transcript_raw is not None
        has_plan = plan_raw is not None
        status = meta.get("status") or derive_status(session_dir)

        preview_source = ""
        if transcript_raw:
            preview_source = (transcript_raw.get("raw_text") or "").strip()
        preview = (preview_source[:180] + "…") if len(preview_source) > 180 else preview_source

        list_item = {
            "id": session_id,
            "patientDisplayName": patient_display_name,
            "createdAt": created_at,
            "status": status,
            "preview": preview,
            "tags": tags,
            "hasTranscript": has_transcript,
            "hasPlan": has_plan,
        }
        meetings_list.append(list_item)

        detail: Dict[str, Any] = dict(list_item)
        if transcript_raw:
            detail["transcript"] = convert_transcript(transcript_raw)
        if plan_raw:
            detail["plan"] = convert_plan(plan_raw)
        err = read_error_message(session_dir)
        if err:
            detail["errorMessage"] = err

        with open(out / "meetings" / f"{session_id}.json", "w", encoding="utf-8") as f:
            json.dump(detail, f, indent=2, ensure_ascii=False)

    meetings_list.sort(key=lambda m: m.get("createdAt") or "", reverse=True)
    with open(out / "meetings.json", "w", encoding="utf-8") as f:
        json.dump(meetings_list, f, indent=2, ensure_ascii=False)

    return len(meetings_list)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--source", default=os.getenv("OUTPUT_DIR", "./output"), help="Source output directory")
    parser.add_argument("--out", default="./frontend_data", help="Output directory for frontend JSON")
    args = parser.parse_args()

    count = export_frontend_data(Path(args.source), Path(args.out))
    print(f"Wrote {count} meetings to {args.out}")


if __name__ == "__main__":
    main()

