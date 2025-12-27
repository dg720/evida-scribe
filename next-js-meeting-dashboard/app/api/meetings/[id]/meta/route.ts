export const runtime = "nodejs"

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const baseUrl = process.env.MEETING_API_BASE_URL

  if (!baseUrl) {
    return new Response(JSON.stringify({ error: "MEETING_API_BASE_URL is not configured" }), {
      status: 500,
      headers: { "content-type": "application/json" },
    })
  }

  const url = `${baseUrl.replace(/\/$/, "")}/api/meetings/${encodeURIComponent(id)}/meta`
  const body = await request.text()
  const res = await fetch(url, {
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
