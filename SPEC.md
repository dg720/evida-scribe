# Evida Scribe - Project Specification

This specification describes the Evida Scribe backend-first coaching pipeline, a minimal API, and a simple Next.js dashboard for viewing meeting artifacts. It replaces the previous wearable dashboard spec.

## 1. Purpose and scope

Evida Scribe processes coaching session audio into:
- A structured lifestyle plan (JSON)
- A transcript (JSON)
- A readable markdown plan

Primary use is local audio files. A minimal FastAPI server serves the artifacts and exposes a webhook for ElevenLabs post-call transcripts. A small Next.js UI (v0 prototype) can read static JSON or the live API.

## 2. In-scope features

- CLI pipeline to process local audio with Whisper (OpenAI) or ElevenLabs STT.
- LLM plan generation using OpenAI with JSON-only output.
- On-disk artifacts stored under OUTPUT_DIR/<session_id>.
- Export artifacts to frontend-friendly JSON for a static UI.
- FastAPI backend to list meetings, read details, and accept ElevenLabs webhooks.
- Next.js dashboard to browse meetings and inspect plan + transcript.

## 3. Out-of-scope / non-goals

- No real meeting provider integration (Granola/Zoom/etc). Only stubs.
- No authentication or multi-user support.
- No database. All state is file-based.
- No medical diagnosis or treatment advice.

## 4. Repo structure (current)

- root CLI and backend: `main.py`, `server/api.py`, `llm/`, `transcription/`, `utils/`
- frontend prototype: `next-js-meeting-dashboard/`
- example data and artifacts: `examples/`
- scripts: `scripts/` (dev helper, export)

## 5. Core data models

Pydantic models in `models.py`:

- `TranscriptUtterance`: speaker, start_time, end_time, text
- `SessionTranscript`: session_id, raw_text, transcript[]
- `Domain`: baseline, smart_goals[], tracking_kpis[], evidence_quotes[]
- `LifestylePlan`: healthy_eating, physical_activity, substances, stress_management, sleep, social_connections

These shapes drive the on-disk JSON artifacts and are converted to camelCase for the frontend.

## 6. CLI pipeline

Entrypoint: `main.py` (Typer)

### 6.1 process-local-audio (implemented)

Inputs:
- `--audio-path` (required)
- `--notes-path` (optional)
- `--provider` (whisper | elevenlabs; defaults to DEFAULT_TRANSCRIPTION_PROVIDER)
- `--session-id` (optional; defaults to audio filename stem)
- `--transcript-path` (optional; skip STT and use a pre-generated transcript JSON)

Steps:
1) Load audio bytes
2) Transcribe via provider (unless transcript_path is given)
3) Generate a LifestylePlan via OpenAI
4) Save artifacts under OUTPUT_DIR/<session_id>

Outputs:
- `session_transcript.json`
- `session_plan.json`
- `session_plan.md`
- `plan_failure.txt` (when plan generation fails)

### 6.2 export-frontend-data (implemented)

`python main.py export-frontend-data --out-dir ./frontend_data`

Reads OUTPUT_DIR artifacts and writes:
- `frontend_data/meetings.json`
- `frontend_data/meetings/<id>.json`

### 6.3 process-meeting-transcript (stub)

This command is a stub and exits with a warning. It must not call external meeting APIs.

## 7. Transcription providers

- Whisper (OpenAI): `transcription/whisper_provider.py`
- ElevenLabs STT: `transcription/elevenlabs_provider.py`

Both implement `TranscriptionProvider.transcribe_audio()` and return SessionTranscript.

## 8. LLM plan generation

Module: `llm/plan_generator.py`

- Uses OpenAI Responses API (with fallback to Chat Completions for older clients).
- Prompt enforces JSON-only output and a fixed schema.
- If the model returns invalid JSON or the schema is wrong, the pipeline stores a failure artifact.

## 9. On-disk artifact format

OUTPUT_DIR/<session_id>/
- `session_transcript.json` (snake_case fields)
- `session_plan.json` (snake_case fields)
- `session_plan.md`
- `session_meta.json` (createdAt, patientDisplayName, tags)
- `plan_failure.txt` (only when plan generation fails)
- `notes.txt` (if notes were provided in the webhook flow)

## 10. Backend API (FastAPI)

Module: `server/api.py`

Endpoints:
- `GET /healthz`
- `GET /api/meetings` (list of MeetingListItem)
- `GET /api/meetings/{meeting_id}` (MeetingDetail)
- `PUT /api/meetings/{meeting_id}/plan` (update plan)
- `GET /api/meetings/{meeting_id}/artifacts/{artifact_name}` (download artifact)
- `DELETE /api/meetings/{meeting_id}`
- `GET /api/notes/current` (draft notes)
- `PUT /api/notes/current` (save draft notes)
- `POST /elevenlabs/webhook` (post-call transcript ingestion)

Notes:
- The API reads from OUTPUT_DIR and merges in seed meetings from `examples/seed_data` when present.
- The webhook validates signatures if MEETING_PROVIDER_WEBHOOK_SECRET (or ELEVENLABS_WEBHOOK_SECRET) is set.
- If OPENAI_API_KEY is set, the webhook also generates a plan; otherwise it only saves the transcript.

## 11. Frontend prototype (Next.js)

Folder: `next-js-meeting-dashboard/`

Two main pages:
- `/meetings` (list)
- `/meetings/[id]` (detail)

Data contracts (camelCase) match the v0 prompt and backend conversions:
- MeetingListItem: id, patientDisplayName, createdAt, status, preview, tags, hasTranscript, hasPlan
- MeetingDetail: MeetingListItem plus transcript and plan

Data sources:
- Static JSON from `frontend_data/` by default
- Live API when `MEETING_API_BASE_URL` is set

## 12. Environment variables

Loaded via `config.py` and `.env`:
- OPENAI_API_KEY (required for plan generation)
- ELEVENLABS_API_KEY (required if using ElevenLabs STT)
- OPENAI_TRANSCRIBE_MODEL (default gpt-4o-mini-transcribe)
- OPENAI_LLM_MODEL (default gpt-4.1-mini)
- ELEVENLABS_STT_MODEL (default scribe_v2)
- DEFAULT_TRANSCRIPTION_PROVIDER (whisper | elevenlabs)
- OUTPUT_DIR (default ./output)
- MEETING_PROVIDER_WEBHOOK_SECRET (optional)

API-only:
- CORS_ORIGINS (defaults to *)
- SEED_DATA_DIR (defaults to examples/seed_data)

Frontend-only:
- MEETING_API_BASE_URL (if set, frontend fetches from API instead of static files)

## 13. Deployment (Railway)

Two services:
- Backend: FastAPI (`uvicorn server.api:app --host 0.0.0.0 --port $PORT`)
- Frontend: Next.js app in `next-js-meeting-dashboard/`

Use `railway.json` for the blueprint and attach a volume for OUTPUT_DIR.

## 14. Acceptance criteria

- CLI can process a local audio file end-to-end and write artifacts.
- Exporter produces frontend_data files from output artifacts.
- API lists meetings and returns detail JSON with transcript and plan when present.
- Frontend renders meeting list and detail using either static or live API data.
- No live meeting provider integrations beyond stubs.
