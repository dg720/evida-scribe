# Render Deployment (Option 2A: Single Backend Service + Persistent Disk)

If you prefer Railway, see `docs/RAILWAY_DEPLOY.md`.

This repo supports an “always-on” FastAPI service on Render that:
- Serves meetings live from `OUTPUT_DIR` (default `./output`)
- Receives ElevenLabs post-call transcripts at `POST /elevenlabs/webhook`
- Persists artifacts only if you use a persistent disk (paid). Free tier is ephemeral.

## What you deploy

### 1) Backend API + Webhook (single Render Web Service)
- Entry point: `server/api.py`
- API endpoints:
  - `GET /healthz`
  - `GET /api/meetings`
  - `GET /api/meetings/{meeting_id}`
  - `GET /api/meetings/{meeting_id}/artifacts/{artifact_name}`
- Webhook endpoint:
  - `POST /elevenlabs/webhook`

## Deploy using Render Blueprint

This repo includes a Render blueprint file: `render.yaml`.

1) Push this repo to GitHub.
2) In Render, click **New +** → **Blueprint**.
3) Select your repo and deploy.
4) The blueprint creates two free-tier services:
   - `evida-scribe-api` (FastAPI API + ElevenLabs webhook)
   - `evida-scribe-frontend` (Next.js frontend)
5) After creation, go to the backend service’s **Environment** tab and set:
   - `CORS_ORIGINS` to your frontend origin (recommended, not `*`)
   - `MEETING_PROVIDER_WEBHOOK_SECRET` if you enabled signature verification in ElevenLabs
   - `OPENAI_API_KEY` if you want the webhook to generate plans (otherwise it will save transcripts only)
6) Go to the frontend service’s **Environment** tab and ensure:
   - `MEETING_API_BASE_URL` points to your backend URL (update if you renamed services or use a custom domain).

### Free tier notes
- The included `render.yaml` is configured for the free tier and uses `OUTPUT_DIR=/tmp/output`.
- This is ephemeral: data may be lost on restart/redeploy and free services may sleep when idle (webhooks can be unreliable).
- To avoid an “empty dashboard” after a restart, the API also serves demo seed meetings shipped in `examples/seed_data/`.

### Repo note (Next.js `lib/` folder)
This repo's root `.gitignore` ignores `lib/` for Python packaging, but explicitly allows `next-js-meeting-dashboard/lib/` so Next.js imports like `@/lib/utils` work in deployments.

### Paid tier (persistent storage)
If you need durable storage + reliable webhooks, attach a persistent disk and set `OUTPUT_DIR=/data/output` (paid).

## Deploy manually (no blueprint)

1) Create a **Web Service** in Render:
   - Runtime: Python
   - Build command: `pip install -r requirements.txt`
   - Start command: `uvicorn server.api:app --host 0.0.0.0 --port $PORT`
2) For free tier, set env var: `OUTPUT_DIR=/tmp/output`
3) (Optional, paid) Add a **Persistent Disk**:
   - Mount path: `/data`
   - Set env var: `OUTPUT_DIR=/data/output`
4) Set env vars (recommended):
   - `CORS_ORIGINS=https://<your-frontend-host>`
   - `MEETING_PROVIDER_WEBHOOK_SECRET=<your secret>` (optional)
   - `OPENAI_API_KEY=<your key>` (optional)

## Configure ElevenLabs webhook

Set your ElevenLabs webhook URL to:

`https://<your-render-service>.onrender.com/elevenlabs/webhook`

If you configured a secret in ElevenLabs, set the same value on Render as:
- `MEETING_PROVIDER_WEBHOOK_SECRET`

## Frontend configuration

Your Next.js/v0 frontend should set:
- `MEETING_API_BASE_URL=https://<your-render-service>.onrender.com`

If deploying on Render as well, set `CORS_ORIGINS` on the backend to the frontend URL.
