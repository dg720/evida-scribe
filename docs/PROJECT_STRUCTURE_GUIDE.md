# Project Structure Guide (Backend + Frontend)

Use this template to keep a clean, predictable repo for a simple deployed backend + frontend.

## Recommended layout

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

## Conventions

- Keep backend and frontend in top-level folders.
- Put deploy guides under `docs/deploy/` and move old providers into `docs/archived/`.
- Store seed/demo data under `backend/seed_data/` and document it in the backend README.
- Keep environment variables in `.env.example` and reference in both READMEs.
- Use a single root `README.md` with short links to backend/frontend READMEs.
- Prefer scripts in `scripts/` over long README command blocks.

## Railway notes

- If you use a blueprint, set each service `rootDirectory` to `backend/` or `frontend/`.
- Mount a volume on the backend and point your data directory to it (e.g., `/data`).
