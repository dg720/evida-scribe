# Evida Coaching Prototype (CLI only)

Process a local coaching session audio file to produce a lifestyle plan using Whisper or ElevenLabs STT plus an OpenAI LLM. Outputs are written to disk as JSON and Markdown. Meeting-provider support is stubbed only.

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
