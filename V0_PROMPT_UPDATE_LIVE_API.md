# v0 Prompt: Update Frontend to Use Live API (Local Uvicorn)

Update the v0 app so it reads meeting data from my live FastAPI backend instead of local `frontend_data`.

## Backend

- Base URL: `http://127.0.0.1:8000`
- Endpoints:
  - `GET /api/meetings` → returns `MeetingListItem[]`
  - `GET /api/meetings/{id}` → returns `MeetingDetail`

## Frontend requirements

1) Add an environment variable:

- `MEETING_API_BASE_URL=http://127.0.0.1:8000`

Create `.env.local` (or update it) and include that variable.

Important note about `127.0.0.1`:
- This only works when the Next.js app is running on the same machine as the API (local dev).
- If the Next.js app is deployed (e.g. Vercel), `127.0.0.1` points to the deployment container, not your laptop.
  - In that case, set `MEETING_API_BASE_URL` to a publicly reachable URL (or use a tunnel like ngrok).

2) Update the data layer so it fetches from the API when `MEETING_API_BASE_URL` is present, otherwise it falls back to reading local JSON from `frontend_data/` (keep fallback for offline demo).

- Edit `lib/data.ts`:
  - If `process.env.MEETING_API_BASE_URL` is set:
    - `fetch(`${base}/api/meetings`, { cache: "no-store" })`
    - `fetch(`${base}/api/meetings/${encodeURIComponent(id)}`, { cache: "no-store" })`
  - Return parsed JSON typed as `MeetingListItem[]` and `MeetingDetail`.

3) Ensure the Meetings pages are not statically generated so new meetings appear without rebuild:

- In `app/meetings/page.tsx` add: `export const dynamic = "force-dynamic"`
- In `app/meetings/[id]/page.tsx`:
  - Remove `generateStaticParams()` and `getAllMeetingIds()` usage
  - Add: `export const dynamic = "force-dynamic"`

4) Do not change the UI layout/components unless necessary; just change data loading.

## Data types (must match existing types)

```ts
export type MeetingStatus = "ready" | "processing" | "failed";

export type TranscriptUtterance = {
  speaker: "coach" | "client" | "unknown";
  startTime?: number | null;
  endTime?: number | null;
  text: string;
};

export type LifestyleDomain = {
  baseline: string;
  smartGoals: string[];
  trackingKpis: string[];
  evidenceQuotes?: string[];
};

export type LifestylePlan = {
  healthyEating: LifestyleDomain;
  physicalActivity: LifestyleDomain;
  substances: LifestyleDomain;
  stressManagement: LifestyleDomain;
  sleep: LifestyleDomain;
  socialConnections: LifestyleDomain;
};

export type MeetingListItem = {
  id: string;
  patientDisplayName: string;
  createdAt: string; // ISO
  status: MeetingStatus;
  preview: string;
  tags: string[];
  hasTranscript: boolean;
  hasPlan: boolean;
};

export type MeetingDetail = MeetingListItem & {
  transcript?: {
    rawText: string;
    utterances: TranscriptUtterance[];
  };
  plan?: LifestylePlan;
  errorMessage?: string;
};
```

## Acceptance checks

- Visiting `/meetings` triggers a network request to `http://127.0.0.1:8000/api/meetings` and renders the list.
- Clicking a meeting loads detail from `http://127.0.0.1:8000/api/meetings/<id>`.
- If the API is down, the app still works using local `frontend_data/` fallback.
- New meeting folders appearing under the backend’s `OUTPUT_DIR` show up on refresh without rebuilding the Next app.
