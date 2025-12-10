import json
from pathlib import Path

from config import settings
from models import LifestylePlan, SessionTranscript


def ensure_output_dir() -> Path:
    base = Path(settings.output_dir)
    base.mkdir(parents=True, exist_ok=True)
    return base


def save_session_outputs(
    session_id: str, transcript: SessionTranscript, plan: LifestylePlan
) -> Path:
    base = ensure_output_dir()
    session_dir = base / session_id
    session_dir.mkdir(parents=True, exist_ok=True)

    with open(session_dir / "session_transcript.json", "w", encoding="utf-8") as f:
        json.dump(transcript.model_dump(), f, indent=2, ensure_ascii=False)

    with open(session_dir / "session_plan.json", "w", encoding="utf-8") as f:
        json.dump(plan.model_dump(), f, indent=2, ensure_ascii=False)

    md_path = session_dir / "session_plan.md"
    with open(md_path, "w", encoding="utf-8") as f:
        f.write(f"# Lifestyle Plan for session {session_id}\n\n")
        plan_dict = plan.model_dump()
        for domain_name, domain in plan_dict.items():
            title = domain_name.replace("_", " ").title()
            f.write(f"## {title}\n\n")
            f.write(f"**Baseline**\n\n{domain['baseline']}\n\n")
            f.write("**SMART Goals**\n\n")
            for goal in domain["smart_goals"]:
                f.write(f"- {goal}\n")
            f.write("\n**Tracking KPIs**\n\n")
            for kpi in domain["tracking_kpis"]:
                f.write(f"- {kpi}\n")
            f.write("\n\n")

    return session_dir


def save_failure_outputs(
    session_id: str,
    transcript: SessionTranscript,
    raw_response: str | None,
    error_message: str,
) -> Path:
    base = ensure_output_dir()
    session_dir = base / session_id
    session_dir.mkdir(parents=True, exist_ok=True)

    with open(session_dir / "session_transcript.json", "w", encoding="utf-8") as f:
        json.dump(transcript.model_dump(), f, indent=2, ensure_ascii=False)

    failure_path = session_dir / "plan_failure.txt"
    with open(failure_path, "w", encoding="utf-8") as f:
        f.write(f"Plan generation failed: {error_message}\n\n")
        if raw_response:
            f.write("Raw LLM response:\n")
            f.write(raw_response)

    return session_dir
