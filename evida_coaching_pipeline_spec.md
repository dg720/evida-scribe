
# Evida Coaching Pipeline – No-Frontend Prototype Specification
Version: 1.1  
Author: Dhruv Gupta  
Purpose: For a code model (e.g. Codex) to generate a full backend-only prototype.

> Note: Granola does **not** expose a usable public API for this prototype, so the **implemented scope is local audio files only (Whisper / ElevenLabs)**. Any “live meeting provider” integration is a *future extension* only and must **not** make real API calls.

---

## 0. Overview

This specification describes a **Python backend prototype** for processing coaching sessions to produce a structured **Lifestyle Plan**.

The prototype supports one concrete mode:

1. **Mode A – Local audio upload**
   - Accept a `.wav` or `.mp3` file from disk.
   - Transcribe using **Whisper (OpenAI)** or **ElevenLabs STT**.
   - Generate a structured plan using an LLM (OpenAI).

A second mode is described as a **future extension only**:

- **Mode B – Live meeting provider (e.g. Granola / Zoom / other)**  
  - Conceptual only: fetch a transcript from an external meeting/transcription provider.
  - Because Granola does not have a public API suitable for this prototype, **no real API calls must be implemented**. Only stub code and comments may be added for future use.

There is **no frontend**.  

Outputs are written to disk:

- `session_transcript.json`
- `session_plan.json`
- `session_plan.md`

The prototype is driven via a **CLI** and (optionally) a minimal **FastAPI stub** for future webhook integration.

---

## 1. Tech Stack

- **Language:** Python 3.11+
- Libraries (must be listed in `requirements.txt`):
  - `openai`
  - `requests`
  - `fastapi`
  - `uvicorn`
  - `typer`
  - `pydantic`
  - `python-dotenv`
- No database.
- No HTML / JS / GUI code.

---

## 2. Environment Configuration (`config.py` + `.env.example`)

Implement a `config.py` module using Pydantic settings (e.g. `BaseSettings`) to load configuration from environment variables.

### 2.1 Environment variables

Must be loaded from `.env` (and a sample `.env.example` must be provided):

```env
OPENAI_API_KEY=
ELEVENLABS_API_KEY=

# OpenAI models
OPENAI_TRANSCRIBE_MODEL=gpt-4o-mini-transcribe
OPENAI_LLM_MODEL=gpt-4.1-mini

# ElevenLabs
ELEVENLABS_STT_MODEL=eden-1

# Default provider for local audio: "whisper" or "elevenlabs"
DEFAULT_TRANSCRIPTION_PROVIDER=whisper

# Output directory
OUTPUT_DIR=./output

# Future extension – meeting provider (NOT used now)
MEETING_PROVIDER_BASE_URL=
MEETING_PROVIDER_API_KEY=
MEETING_PROVIDER_WEBHOOK_SECRET=
````

Behaviour:

* Fail fast if `OPENAI_API_KEY` is missing.
* `ELEVENLABS_API_KEY` may be empty if user doesn’t use ElevenLabs.
* Expose a `settings` object with attributes like:

  * `openai_api_key`
  * `elevenlabs_api_key`
  * `openai_transcribe_model`
  * `openai_llm_model`
  * `elevenlabs_stt_model`
  * `default_transcription_provider`
  * `output_dir`

---

## 3. Folder Structure

The code model must generate the following structure:

```text
evida_coaching_prototype/
│
├─ main.py
├─ config.py
├─ models.py
│
├─ transcription/
│   ├─ __init__.py
│   ├─ base.py
│   ├─ whisper_provider.py
│   └─ elevenlabs_provider.py
│   # OPTIONAL: meeting_client_stub.py (no real API calls)
│
├─ llm/
│   ├─ __init__.py
│   └─ plan_generator.py
│
├─ server_stub/
│   ├─ __init__.py
│   └─ webhook_stub.py
│
├─ utils/
│   ├─ io_utils.py
│   └─ logging_utils.py
│
├─ requirements.txt
└─ .env.example
```

Notes:

* `server_stub/` is only for a future webhook; it must not do real meeting-provider work.
* `meeting_client_stub.py` (if created) must clearly be a placeholder raising `NotImplementedError`.

---

## 4. Data Models (`models.py`)

Use Pydantic for structured data.

```python
from pydantic import BaseModel
from typing import List, Optional

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
```

`LifestylePlan` is the main structured output that mirrors the questionnaire domains.

---

## 5. Transcription Providers (`transcription/`)

### 5.1 Base interface (`transcription/base.py`)

Define an abstract base class for transcription providers:

```python
from abc import ABC, abstractmethod
from models import SessionTranscript

class TranscriptionProvider(ABC):

    @abstractmethod
    def transcribe_audio(self, audio_bytes: bytes, session_id: str) -> SessionTranscript:
        """Return a SessionTranscript for the given audio bytes."""
        raise NotImplementedError
```

### 5.2 Whisper Provider (`transcription/whisper_provider.py`)

Use the `openai` Python client and the model specified in `OPENAI_TRANSCRIBE_MODEL`.

* Constructor:

  * Accepts `api_key: str`, `model_name: str`.
* `transcribe_audio()`:

  * Calls:

    ```python
    resp = client.audio.transcriptions.create(
        model=model_name,
        file=("session.wav", audio_bytes)
    )
    ```

  * Extracts `text = resp.text`.

  * Builds a `SessionTranscript` with:

    * `session_id`
    * `raw_text = text`
    * `transcript = [TranscriptUtterance(speaker="unknown", text=text)]`.

### 5.3 ElevenLabs Provider (`transcription/elevenlabs_provider.py`)

Use ElevenLabs Speech-to-Text API.

* Constructor:

  * Accepts `api_key: str`, `model_name: str`.
  * Sets `base_url = "https://api.elevenlabs.io/v1/speech-to-text"`.
* `transcribe_audio()`:

  * Makes a `POST` request using `requests`:

    * Headers: `{"xi-api-key": api_key}`
    * Files: `{"file": ("session.wav", audio_bytes)}`
    * Data: `{"model": model_name, "diarize": "true", "language": "en"}`

  * Expects JSON something like:

    ```json
    {
      "transcript": [
        { "speaker": "SPEAKER_1", "text": "..." },
        { "speaker": "SPEAKER_2", "text": "..." }
      ]
    }
    ```

  * For each item in `result["transcript"]`, create a `TranscriptUtterance`.

  * Concatenate all `text` values (with newlines) into `raw_text`.

  * Return `SessionTranscript`.

Implementation must be robust to slight JSON differences (use `.get` and comments).

### 5.4 Meeting Provider Stub (`transcription/meeting_client_stub.py`)

**No real meeting integration.** This is only a placeholder.

Example:

```python
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
```

---

## 6. LLM Pipeline (`llm/plan_generator.py`)

Use OpenAI’s Responses API in JSON mode to turn a `SessionTranscript` + optional notes into a `LifestylePlan`.

### 6.1 Prompt template

Define:

```python
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
- "baseline": 1–3 sentences summarising the client's current situation.
- "smart_goals": a list of 1–3 SMART goals, phrased concretely and, where possible, in the client's tone.
- "tracking_kpis": a list of 2–5 measurable indicators (e.g. steps per day, alcohol units per week, bedtime consistency).

Use only information present or strongly implied in the transcript and notes.
If there is not enough information for a domain, still fill the fields but explicitly state that information is incomplete.

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
{transcript_text}

NOTES:
{notes_text}
"""
```

### 6.2 Generation function

Implement:

```python
from openai import OpenAI
import json
from models import LifestylePlan, SessionTranscript
from config import settings

client = OpenAI(api_key=settings.openai_api_key)

def generate_lifestyle_plan(transcript: SessionTranscript, notes: str) -> LifestylePlan:
    transcript_text = transcript.raw_text

    prompt = PROMPT_TEMPLATE.format(
        transcript_text=transcript_text,
        notes_text=notes or ""
    )

    response = client.responses.create(
        model=settings.openai_llm_model,
        input=prompt,
        response_format={"type": "json_object"},
    )

    json_str = response.output[0].content[0].text
    data = json.loads(json_str)
    return LifestylePlan(**data)
```

Handle exceptions minimally (log and re-raise if needed).

---

## 7. IO Utilities (`utils/io_utils.py`)

### 7.1 Output directory

* Use `OUTPUT_DIR` from config (default `./output`).
* For each `session_id`, create `OUTPUT_DIR/<session_id>/`.

### 7.2 Saving outputs

Implement:

```python
from pathlib import Path
import json
from models import SessionTranscript, LifestylePlan
from config import settings

def ensure_output_dir() -> Path:
    base = Path(settings.output_dir)
    base.mkdir(parents=True, exist_ok=True)
    return base

def save_session_outputs(session_id: str, transcript: SessionTranscript, plan: LifestylePlan) -> Path:
    base = ensure_output_dir()
    session_dir = base / session_id
    session_dir.mkdir(parents=True, exist_ok=True)

    # 1. Transcript JSON
    with open(session_dir / "session_transcript.json", "w", encoding="utf-8") as f:
        json.dump(transcript.model_dump(), f, indent=2, ensure_ascii=False)

    # 2. Plan JSON
    with open(session_dir / "session_plan.json", "w", encoding="utf-8") as f:
        json.dump(plan.model_dump(), f, indent=2, ensure_ascii=False)

    # 3. Plan Markdown
    md_path = session_dir / "session_plan.md"
    with open(md_path, "w", encoding="utf-8") as f:
        f.write(f"# Lifestyle Plan for session {session_id}\\n\\n")
        plan_dict = plan.model_dump()
        for domain_name, domain in plan_dict.items():
            title = domain_name.replace("_", " ").title()
            f.write(f"## {title}\\n\\n")
            f.write(f"**Baseline**\\n\\n{domain['baseline']}\\n\\n")
            f.write("**SMART Goals**\\n\\n")
            for g in domain["smart_goals"]:
                f.write(f"- {g}\\n")
            f.write("\\n**Tracking KPIs**\\n\\n")
            for kpi in domain["tracking_kpis"]:
                f.write(f"- {kpi}\\n")
            f.write("\\n\\n")

    return session_dir
```

---

## 8. Logging Utilities (`utils/logging_utils.py`)

Provide a simple `get_logger` helper:

```python
import logging

def get_logger(name: str) -> logging.Logger:
    logger = logging.getLogger(name)
    if not logger.handlers:
        logger.setLevel(logging.INFO)
        handler = logging.StreamHandler()
        formatter = logging.Formatter("[%(asctime)s] [%(levelname)s] %(name)s: %(message)s")
        handler.setFormatter(formatter)
        logger.addHandler(handler)
    return logger
```

Use this in main modules (transcription providers, LLM, CLI).

---

## 9. CLI Entrypoint (`main.py`)

Use `typer` to implement a CLI with two commands:

### 9.1 `process-local-audio` – **fully implemented**

Example usage:

```bash
python main.py process-local-audio \
  --audio-path path/to/audio.wav \
  --notes-path path/to/notes.txt \
  --provider whisper
```

Behaviour:

1. Read audio bytes from `audio_path`.
2. If `session_id` not provided, infer from filename stem.
3. Read notes from `notes_path` if provided; otherwise use empty string.
4. Choose transcription provider:

   * `"whisper"` → use `WhisperProvider`.
   * `"elevenlabs"` → use `ElevenLabsProvider`.
   * If provider not specified, use `settings.default_transcription_provider`.
5. Call `transcribe_audio()` → `SessionTranscript`.
6. Call `generate_lifestyle_plan()` → `LifestylePlan`.
7. Call `save_session_outputs()` → returns the session directory path.
8. Print path to stdout.

### 9.2 `process-meeting-transcript` – **stub only**

Example usage:

```bash
python main.py process-meeting-transcript --conversation-id abc123
```

Behaviour:

* Log / print: `"Meeting provider integration is not implemented. This is a stub."`
* Optionally raise `NotImplementedError` or exit with non-zero code.
* Do **not** call external APIs or generate a plan.

---

## 10. Server Stub (`server_stub/webhook_stub.py`)

Create a minimal FastAPI app for a future webhook (stub only):

```python
from fastapi import FastAPI, Request

app = FastAPI()

@app.post("/webhook/meeting-provider")
async def meeting_provider_webhook(request: Request):
    """
    Stub endpoint for future meeting provider integration.
    Currently does nothing beyond echoing the payload.
    """
    payload = await request.json()
    return {"status": "stub", "received": payload}
```

No transcript fetching or plan generation should occur here yet.

---

## 11. Requirements (`requirements.txt`)

Create a minimal requirements file:

```text
openai
requests
fastapi
uvicorn
pydantic
python-dotenv
typer
```

Version pinning is optional.

---

## 12. `.env.example`

Create a template `.env.example` file with:

```env
OPENAI_API_KEY=sk-...
ELEVENLABS_API_KEY=

OPENAI_TRANSCRIBE_MODEL=gpt-4o-mini-transcribe
OPENAI_LLM_MODEL=gpt-4.1-mini
ELEVENLABS_STT_MODEL=eden-1

DEFAULT_TRANSCRIPTION_PROVIDER=whisper
OUTPUT_DIR=./output

# Future meeting provider (NOT used in prototype)
MEETING_PROVIDER_BASE_URL=
MEETING_PROVIDER_API_KEY=
MEETING_PROVIDER_WEBHOOK_SECRET=
```

---

## 13. Boundaries & Non-Goals

The code model must respect these constraints:

* **No frontend / web UI / HTML**.

* **No database** — all state is stored as files on disk.

* **No real integration with Granola or other meeting providers**:

  * Only stub code and placeholder classes.

* Code must be runnable via:

  ```bash
  pip install -r requirements.txt
  python main.py --help
  ```

* Any external URLs for unimplemented providers must be documented as placeholders.

---

## 14. Deliverables the Code Model Should Produce

1. All Python files as defined in the folder structure.
2. A working CLI command `process-local-audio` that:

   * Transcribes audio with Whisper or ElevenLabs.
   * Generates a structured `LifestylePlan`.
   * Saves outputs (JSON and Markdown) under `OUTPUT_DIR/<session_id>/`.
3. A stub CLI command `process-meeting-transcript`.
4. A stub FastAPI app in `server_stub/webhook_stub.py`.
5. `requirements.txt` and `.env.example`.
6. Code that is reasonably documented, especially where API details may need adjusting.

# END OF SPEC


