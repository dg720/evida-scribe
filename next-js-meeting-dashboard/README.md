# Next.js Meeting Dashboard (v0)

This is the v0-generated frontend for browsing “Meeting Profiles”.

## Data sources

By default, the app reads static JSON from `./frontend_data` using server-side `fs/promises`.

To switch to the live FastAPI backend, set:

```bash
MEETING_API_BASE_URL=http://localhost:8000
```

See `.env.local.example` and the root `README.md` for backend commands.

