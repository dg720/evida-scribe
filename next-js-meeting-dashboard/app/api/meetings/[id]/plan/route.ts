export const runtime = "nodejs"

function baseUrl() {
  const base = process.env.MEETING_API_BASE_URL
  if (!base) throw new Error("MEETING_API_BASE_URL is not configured")
  return base.replace(/\/$/, "")
}

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const body = await req.text()
  const res = await fetch(`${baseUrl()}/api/meetings/${encodeURIComponent(id)}/plan`, {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body,
  })
  const text = await res.text()
  return new Response(text, {
    status: res.status,
    headers: { "content-type": res.headers.get("content-type") || "application/json" },
  })
}

