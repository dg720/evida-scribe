# Evida Scribe API usage (for importing meetings into another project)

This note explains how another project can read current meeting names/ids from Evida Scribe, show them in a dropdown, and import selected meeting data.

## 1) List meetings (names + ids)

Endpoint:
- `GET /api/meetings`

Response: array of meeting list items. Use these fields for the dropdown:
- `id` (meeting id)
- `patientDisplayName` (display name)
- `createdAt`
- `status`

Example response item:
```json
{
  "id": "meeting_2025_01_10",
  "patientDisplayName": "Mental Health Focus",
  "createdAt": "2025-01-10T11:25:00Z",
  "status": "ready",
  "preview": "I need to improve my mental health",
  "tags": [],
  "hasTranscript": true,
  "hasPlan": true
}
```

## 2) Dropdown data model

Build options from the list response. Prefer showing the display name with the date, but store the id for selection.

Example:
```
label = `${patientDisplayName} - ${createdAt}`
value = id
```

## 3) Fetch meeting details (for import)

Endpoint:
- `GET /api/meetings/{meeting_id}`

This returns the meeting detail object, including `transcript` and `plan` (camelCase).

## 4) Import raw artifacts (recommended)

If you want to copy the exact on-disk artifacts (snake_case), download them directly:

- `GET /api/meetings/{meeting_id}/artifacts/session_transcript.json`
- `GET /api/meetings/{meeting_id}/artifacts/session_plan.json`
- `GET /api/meetings/{meeting_id}/artifacts/session_plan.md`
- `GET /api/meetings/{meeting_id}/artifacts/session_meta.json`

Place them under:
- `OUTPUT_DIR/<meeting_id>/` in the target project.

This is the safest import path if the target project expects the same file format as Evida Scribe.

## 5) Example fetch flow (pseudo-code)

```ts
// 1) List meetings for dropdown
const res = await fetch(`${SOURCE_BASE_URL}/api/meetings`, { cache: "no-store" })
const meetings = await res.json()
const options = meetings.map((m: any) => ({
  value: m.id,
  label: `${m.patientDisplayName} - ${new Date(m.createdAt).toLocaleString()}`,
}))

// 2) User selects a meeting id
const selectedId = options[0].value

// 3) Import details
const detailRes = await fetch(`${SOURCE_BASE_URL}/api/meetings/${encodeURIComponent(selectedId)}`)
const meetingDetail = await detailRes.json()

// 4) (Optional) download artifacts instead of using meetingDetail
```

## 6) Notes

- `patientDisplayName` is the meeting name used in the UI.
- Meeting ids are stable folder names under `OUTPUT_DIR`.
- If you need raw files, use the artifact endpoints rather than the detail endpoint.
