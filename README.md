# Evida Coaching Prototype (CLI only)

Process a local coaching session audio file to produce a lifestyle plan using Whisper or ElevenLabs STT plus an OpenAI LLM. Outputs are written to disk as JSON and Markdown. Meeting-provider support is stubbed only.

## Frontend (v0 prototype)
This repo includes a starter “static data” workflow for generating a hosted Next.js UI with v0 (single-user, no auth). The idea is:
- Keep pipeline artifacts under `./output/<session_id>/` (gitignored by default)
- Export a frontend-friendly JSON shape under `./frontend_data/` (committable) for the UI to read

Prompt + guidance: `V0_PROMPT.md`

Export frontend data after running the pipeline:
```bash
python main.py export-frontend-data --out-dir ./frontend_data
```
This writes `frontend_data/meetings.json` and `frontend_data/meetings/<id>.json`.

If you want a stdlib-only export (no Python deps installed), use:
```bash
python scripts/export_frontend_data.py --source ./output --out ./frontend_data
```

## Backend API (live data from ./output)
For a “live” frontend (no redeploy needed), run the FastAPI backend that reads meeting artifacts directly from `OUTPUT_DIR` (default `./output`) and serves them as JSON:

- Start API:
  ```bash
  uvicorn server.api:app --reload --port 8000
  ```
- Endpoints:
  - `GET http://localhost:8000/api/meetings`
  - `GET http://localhost:8000/api/meetings/<meeting_id>`

### v0 frontend → backend
The uploaded v0 project lives at `next-js-meeting-dashboard/`. It can use either:
- Static JSON: reads from `next-js-meeting-dashboard/frontend_data/` (default)
- Live API: set `MEETING_API_BASE_URL=http://localhost:8000` in the Next.js environment and it will fetch from the backend instead of filesystem.

## Quick start
1) Create a `.env` (see `.env.example`) with at least `OPENAI_API_KEY` set. Add `ELEVENLABS_API_KEY` if using ElevenLabs STT.
2) Install deps: `pip install -r requirements.txt`
3) Run the CLI (Whisper example):
   ```bash
   python main.py process-local-audio --audio-path ./example_meeting.mp3
   ```
   - Place your audio file at `./example_meeting.mp3` (or pass any path you prefer).
   - Optional notes: `--notes-path ./notes.txt`
   - Choose provider: `--provider whisper` (default) or `--provider elevenlabs` (use ElevenLabs models such as `scribe_v2`)
4) Outputs land under `OUTPUT_DIR/<session_id>/` (defaults to `./output/<audio_stem>/`).

## Commands
- `python main.py process-local-audio ...` — fully implemented pipeline.
- `python main.py export-frontend-data ...` exports frontend-friendly JSON from `./output` into `./frontend_data` for the v0/Next UI prototype.
- `python main.py process-meeting-transcript --conversation-id ...` — stub only; no external calls.

## Server stub
Run a placeholder webhook (no meeting integration yet):
```bash
uvicorn server_stub.webhook_stub:app --reload
```

### ElevenLabs post-call webhook (optional)
Expose an endpoint to receive ElevenLabs post-call transcripts:
```bash
uvicorn server_stub.elevenlabs_webhook:app --reload
```
Set the webhook URL in ElevenLabs to `/elevenlabs/webhook`. If you configure a secret, place it in `MEETING_PROVIDER_WEBHOOK_SECRET` so signatures can be verified.

## Readiness to test
- Requirements file and code are in place; set env vars before running.
- Provide a valid audio file (e.g., `example_meeting.mp3`) locally; none is bundled in the repo.
- Network access is required for OpenAI (and ElevenLabs if chosen). Terms and billing apply.
