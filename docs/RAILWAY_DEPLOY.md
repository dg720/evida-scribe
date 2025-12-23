# Railway Deployment (Recommended)

This repo supports a two-service Railway deployment:
- `evida-scribe-api` (FastAPI backend + webhook)
- `evida-scribe-frontend` (Next.js UI)

The included Railway blueprint also wires up a persistent volume for meeting artifacts.

## Deploy with a Railway Blueprint

1) Push this repo to GitHub.
2) In Railway, click **New Project** -> **Deploy from GitHub Repo**.
3) Select this repo and choose **Use blueprint** when prompted.
4) Railway creates two services from `railway.json`.

## Backend service configuration

The backend service is configured to:
- Start with: `uvicorn server.api:app --host 0.0.0.0 --port $PORT`
- Persist artifacts under `OUTPUT_DIR=/data/output`
- Serve seed data from `SEED_DATA_DIR=/app/examples/seed_data`

If Railway does not auto-create the volume, add a **Volume** to the backend service:
- Mount path: `/data`
- Keep `OUTPUT_DIR=/data/output`

Recommended env vars:
- `CORS_ORIGINS=https://<your-frontend-domain>`
- `MEETING_PROVIDER_WEBHOOK_SECRET=<optional>`
- `OPENAI_API_KEY=<optional>` (only needed if webhook should generate plans)

## Frontend service configuration

The frontend service needs the backend URL:
- Set `MEETING_API_BASE_URL=https://<your-backend-domain>`

If you use a custom domain, update this value to match.

## ElevenLabs webhook

Set your ElevenLabs webhook URL to:

`https://<your-backend-domain>/elevenlabs/webhook`

If you configured a secret in ElevenLabs, set the same value on Railway as:
- `MEETING_PROVIDER_WEBHOOK_SECRET`
