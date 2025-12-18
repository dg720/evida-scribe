import { readFile, readdir } from "fs/promises"
import { join } from "path"
import type { MeetingListItem, MeetingDetail } from "./types"

const DATA_DIR = join(process.cwd(), "frontend_data")
const API_BASE_URL = process.env.MEETING_API_BASE_URL

function normalizeBaseUrl(baseUrl: string): string {
  return baseUrl.trim().replace(/\/$/, "")
}

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url, { cache: "no-store" })
  const contentType = res.headers.get("content-type") || ""
  const text = await res.text()

  if (!res.ok) {
    console.error(`[SERVER] API error ${res.status} ${res.statusText} for ${url}. Body: ${text.slice(0, 200)}`)
    throw new Error(`API error ${res.status}`)
  }

  if (!contentType.includes("application/json")) {
    console.error(
      `[SERVER] Expected JSON from ${url} but got content-type=${contentType}. Body: ${text.slice(0, 200)}`,
    )
    throw new Error("Non-JSON API response")
  }

  try {
    return JSON.parse(text) as T
  } catch (e) {
    console.error(`[SERVER] Failed to parse JSON from ${url}. Body: ${text.slice(0, 200)}`)
    throw e
  }
}

export async function getMeetings(): Promise<MeetingListItem[]> {
  if (API_BASE_URL) {
    const base = normalizeBaseUrl(API_BASE_URL)
    if ((base.includes("127.0.0.1") || base.includes("localhost")) && process.env.VERCEL) {
      console.error(
        `[SERVER] MEETING_API_BASE_URL=${base} points to localhost, which won't work from a deployed app. Use a public URL (or a tunnel like ngrok) instead.`,
      )
    }
    try {
      return await fetchJson<MeetingListItem[]>(`${base}/api/meetings`)
    } catch (error) {
      console.error("[SERVER] Error fetching from API:", error)
      return []
    }
  }

  try {
    const filePath = join(DATA_DIR, "meetings.json")
    const content = await readFile(filePath, "utf-8")
    return JSON.parse(content)
  } catch (error) {
    console.error("Error reading meetings list:", error)
    return []
  }
}

export async function getMeeting(id: string): Promise<MeetingDetail | null> {
  if (API_BASE_URL) {
    const base = normalizeBaseUrl(API_BASE_URL)
    try {
      return await fetchJson<MeetingDetail>(`${base}/api/meetings/${encodeURIComponent(id)}`)
    } catch (error) {
      console.error("[SERVER] Error fetching from API:", error)
      return null
    }
  }

  try {
    const filePath = join(DATA_DIR, "meetings", `${id}.json`)
    const content = await readFile(filePath, "utf-8")
    return JSON.parse(content)
  } catch (error) {
    console.error(`Error reading meeting ${id}:`, error)
    return null
  }
}

export async function getAllMeetingIds(): Promise<string[]> {
  if (API_BASE_URL) {
    const meetings = await getMeetings()
    return meetings.map((m) => m.id)
  }

  try {
    const meetingsDir = join(DATA_DIR, "meetings")
    const files = await readdir(meetingsDir)
    return files.filter((file) => file.endsWith(".json")).map((file) => file.replace(".json", ""))
  } catch (error) {
    console.error("Error reading meeting IDs:", error)
    return []
  }
}
