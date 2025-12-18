# v0 Prompt: Hosted Frontend (Initial, Static Data)

Goal: generate a clean, professional Next.js frontend with v0 so you can browse “meeting profiles” (one profile per meeting) and view transcript + plan in a clinical layout. This initial version assumes **single user**, **no auth**, and **data stored in the repo** (static JSON). Later you can swap to a real backend/API.

## How the data is stored in this repo (today)

- The pipeline writes session artifacts under `output/<session_id>/`:
  - `session_transcript.json` (see `models.SessionTranscript`)
  - `session_plan.json` (see `models.LifestylePlan`)
  - `session_plan.md`
  - `plan_failure.txt` (when plan generation fails)
- For the frontend prototype, sample mock data is included in:
  - `examples/frontend_data/meetings.json` (list)
  - `examples/frontend_data/meetings/<id>.json` (detail)

## Generate/update frontend data from real outputs

After you run the pipeline and it writes to `./output`, export frontend-friendly JSON (camelCase) by running:

```bash
python main.py export-frontend-data --out-dir ./frontend_data
```

This scans `OUTPUT_DIR` (default `./output`) and writes:
- `frontend_data/meetings.json`
- `frontend_data/meetings/<session_id>.json`

## v0 prompt (copy/paste into v0)

Build a Next.js 14+ application (App Router) using TypeScript, Tailwind CSS, and shadcn/ui. The app is a single-user dashboard for viewing recorded “Meeting Profiles” (each meeting is treated as a separate profile for now). No authentication.

Data source: static JSON in the repo under `frontend_data/`.
- `frontend_data/meetings.json` contains an array of meeting list items.
- `frontend_data/meetings/<id>.json` contains the detail record for a single meeting.

Implement two pages:
1) `/meetings` — Meeting Profiles list
2) `/meetings/[id]` — Meeting Profile detail (plan + transcript)

UI requirements (professional clinical layout):
- Clean typography, muted color palette, subtle borders, responsive layout.
- Excellent loading / empty / error states.

Meetings list page (`/meetings`):
- Header: “Meeting Profiles”
- Search input: filters by patientDisplayName and preview
- Filters: status (ready/processing/failed), tag (optional)
- Desktop: table layout. Mobile: card layout.
- Each row/card shows: patientDisplayName, createdAt (formatted), status badge, preview, tags, and a “View” button.

Meeting detail page (`/meetings/[id]`):
- Breadcrumb back to Meetings.
- Header with: patientDisplayName, createdAt, status badge.
- Action buttons:
  - Copy transcript
  - Copy summary (derived from plan; if no plan show disabled)
  - Download JSON (downloads the detail JSON)
- Two-column layout on desktop:
  - Left: Plan panel (LifestylePlan domains) using Accordion by domain.
  - Right: Transcript panel with Tabs (“Formatted” utterances vs “Raw text”).
- If `status="failed"` show a prominent error callout with `errorMessage` (if present).
- If plan missing, show an informative placeholder in the plan panel.

Data contract (TypeScript types; use these shapes exactly):
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

Data loading approach:
- Create a tiny “data access” module, e.g. `lib/data.ts`, that reads JSON from `frontend_data/` using Node `fs/promises` (server-side only).
  - `getMeetings(): Promise<MeetingListItem[]>` reads `frontend_data/meetings.json`
  - `getMeeting(id: string): Promise<MeetingDetail | null>` reads `frontend_data/meetings/<id>.json`
- Use server components to load the list and the detail, so it works on Vercel without a separate backend.

Upgrade path to “live” backend (no redeploy needed for new meetings):
- In `lib/data.ts`, if `process.env.MEETING_API_BASE_URL` is set, fetch from:
  - `${MEETING_API_BASE_URL}/api/meetings`
  - `${MEETING_API_BASE_URL}/api/meetings/:id`
- Force dynamic rendering (`export const dynamic = "force-dynamic"`) on pages that should update as new meetings appear.

Components to use:
- shadcn/ui: `Card`, `Table`, `Badge`, `Button`, `Input`, `Tabs`, `Accordion`, `ScrollArea`, `Separator`, `Skeleton`, `Alert`.

Also add:
- A simple home redirect from `/` to `/meetings`.
- Basic date formatting helper.
- Make the transcript panel scrollable and readable for long content.

Finally, include example data files in the repo (already present):
- `examples/frontend_data/meetings.json`
- `examples/frontend_data/meetings/example_meeting_clean.json`
- `examples/frontend_data/meetings/meeting_2025_01_03.json`
- `examples/frontend_data/meetings/meeting_2025_01_10.json`

Deliver the full code for this Next.js app.
