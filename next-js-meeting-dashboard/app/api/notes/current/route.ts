export const runtime = "nodejs"

function baseUrl() {
  const base = process.env.MEETING_API_BASE_URL
  if (!base) throw new Error("MEETING_API_BASE_URL is not configured")
  return base.replace(/\/$/, "")
}

export async function GET() {
  try {
    const res = await fetch(`${baseUrl()}/api/notes/current`, { cache: "no-store" })
    const text = await res.text()
    return new Response(text, {
      status: res.status,
      headers: { "content-type": res.headers.get("content-type") || "application/json" },
    })
  } catch (e) {
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { "content-type": "application/json" },
    })
  }
}

export async function PUT(req: Request) {
  try {
    const body = await req.text()
    const res = await fetch(`${baseUrl()}/api/notes/current`, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body,
    })
    const text = await res.text()
    return new Response(text, {
      status: res.status,
      headers: { "content-type": res.headers.get("content-type") || "application/json" },
    })
  } catch (e) {
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { "content-type": "application/json" },
    })
  }
}

