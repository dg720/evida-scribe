# Railway CLI Deploy Guide (Frontend + Backend)

Codex usage: follow this file as a runbook. Execute the commands in order, fill in
the placeholders, and do not pause for confirmation unless a command fails or
needs missing information.

Use this checklist to deploy a simple two-service app (backend + frontend) on Railway
using the CLI. It is intentionally repo-agnostic.

## Prereqs

- Railway CLI installed and authenticated (`railway login`)
- Repo cloned locally
- Working directory is repo root

## 1) Link project and environment

```bash
railway link
```

Select the target workspace, project, and environment (usually `production`).

## 2) Deploy backend (API)

Link the backend service and deploy from the repo root:

```bash
railway service <backend-service-name>
railway up -s <backend-service-name> -d
```

## 3) Add persistent storage for backend data

Attach a volume and point your backend data directory to it:

```bash
railway service <backend-service-name>
railway volume add -m /data
railway variables --set "OUTPUT_DIR=/data/output"
```

Optional: if your backend serves seed/demo data from a folder, set its path:

```bash
railway variables --set "SEED_DATA_DIR=/app/seed_data"
```

Recommended backend env vars:

```bash
railway variables --set "CORS_ORIGINS=https://<your-frontend-domain>"
railway variables --set "OPENAI_API_KEY=sk-..."
railway variables --set "WEBHOOK_SECRET=..."
```

## 4) Deploy frontend (Next.js)

Link the frontend service and deploy from the repo root:

```bash
railway service <frontend-service-name>
railway up -s <frontend-service-name> -d
```

## 5) Set frontend env vars

Point the frontend at the backend base URL (include https):

```bash
railway service <frontend-service-name>
railway variables --set "MEETING_API_BASE_URL=https://<your-backend-domain>"
```

If the frontend is memory constrained, cap Node memory:

```bash
railway variables --set "NODE_OPTIONS=--max-old-space-size=512"
```

## 6) Verify services

Backend health:

```bash
curl https://<your-backend-domain>/healthz
```

Backend API example:

```bash
curl https://<your-backend-domain>/api/health
```

Frontend:

```bash
open https://<your-frontend-domain>
```

## 7) Common fixes

- Frontend hangs: backend base URL must include `https://` and be reachable.
- API data missing after redeploy: ensure a volume is attached and your data dir points to it.
- Seed data missing: verify the seed directory path and that it is present in the image.

## 8) Recommended repo structure

```
.
├─ backend/
│  ├─ app/                 # backend source code
│  ├─ tests/
│  ├─ requirements.txt     # or pyproject.toml / package.json
│  └─ README.md
├─ frontend/
│  ├─ app/                 # frontend source code
│  ├─ public/
│  ├─ package.json
│  └─ README.md
├─ docs/
│  ├─ deploy/              # deployment guides
│  ├─ architecture/        # diagrams, specs
│  └─ archived/            # deprecated guides/configs
├─ scripts/                # dev/ops helpers
├─ .env.example
├─ .gitignore
├─ README.md
└─ railway.json            # optional blueprint
```

Conventions:
- Keep backend and frontend in top-level folders.
- Put deploy guides under `docs/deploy/` and move old providers into `docs/archived/`.
- Store seed/demo data under `backend/seed_data/` and document it in the backend README.
- Keep environment variables in `.env.example` and reference in both READMEs.
- Use a single root `README.md` with short links to backend/frontend READMEs.
- Prefer scripts in `scripts/` over long README command blocks.
