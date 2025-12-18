"use client"

import { useEffect, useMemo, useRef, useState, useTransition } from "react"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { formatDate } from "@/lib/format"
import type { MeetingListItem, MeetingStatus } from "@/lib/types"
import Link from "next/link"
import { Filter, RefreshCw, Search, Trash2 } from "lucide-react"
import { useRouter } from "next/navigation"
import { useMobile } from "@/hooks/use-mobile"
import { useToast } from "@/hooks/use-toast"

interface MeetingsClientProps {
  meetings: MeetingListItem[]
}

const statusConfig: Record<MeetingStatus, { label: string; variant: "default" | "secondary" | "destructive" }> = {
  ready: { label: "Ready", variant: "default" },
  processing: { label: "Processing", variant: "secondary" },
  failed: { label: "Failed", variant: "destructive" },
}

export function MeetingsClient({ meetings }: MeetingsClientProps) {
  const [searchQuery, setSearchQuery] = useState("")
  const [statusFilter, setStatusFilter] = useState<MeetingStatus | "all">("all")
  const [isRefreshing, startRefresh] = useTransition()
  const router = useRouter()
  const isMobile = useMobile()
  const { toast } = useToast()

  const [notes, setNotes] = useState("")
  const [notesStatus, setNotesStatus] = useState<"idle" | "saving" | "saved" | "error">("idle")
  const notesSaveTimer = useRef<number | null>(null)
  const [lastSeenMeetingId, setLastSeenMeetingId] = useState<string | null>(meetings[0]?.id ?? null)
  const lastSeenMeetingIdRef = useRef<string | null>(meetings[0]?.id ?? null)

  // Keep in sync as server-provided meetings change on refresh/navigation.
  useEffect(() => {
    setLastSeenMeetingId(meetings[0]?.id ?? null)
    lastSeenMeetingIdRef.current = meetings[0]?.id ?? null
  }, [meetings])

  useEffect(() => {
    // Load existing draft notes (single-user) when opening the Voice Agent tab.
    fetch("/api/notes/current", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data && typeof data.notes === "string") setNotes(data.notes)
      })
      .catch(() => {})
  }, [])

  useEffect(() => {
    lastSeenMeetingIdRef.current = lastSeenMeetingId
  }, [lastSeenMeetingId])

  useEffect(() => {
    // Best-effort: poll periodically while the dashboard is open.
    // This helps auto-refresh when a new meeting transcript arrives.
    const interval = window.setInterval(() => {
      void checkForNewMeetings()
    }, 15_000)
    return () => window.clearInterval(interval)
  }, [])

  const filteredMeetings = useMemo(() => {
    return meetings.filter((meeting) => {
      const matchesSearch =
        meeting.patientDisplayName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        meeting.preview.toLowerCase().includes(searchQuery.toLowerCase())
      const matchesStatus = statusFilter === "all" || meeting.status === statusFilter
      return matchesSearch && matchesStatus
    })
  }, [meetings, searchQuery, statusFilter])

  const statusCounts = useMemo(() => {
    return {
      all: meetings.length,
      ready: meetings.filter((m) => m.status === "ready").length,
      processing: meetings.filter((m) => m.status === "processing").length,
      failed: meetings.filter((m) => m.status === "failed").length,
    }
  }, [meetings])

  const handleDelete = (meeting: MeetingListItem) => {
    const ok = window.confirm(`Delete meeting \"${meeting.patientDisplayName}\"? This cannot be undone.`)
    if (!ok) return

    startRefresh(async () => {
      try {
        const res = await fetch(`/api/meetings/${encodeURIComponent(meeting.id)}`, { method: "DELETE" })
        if (!res.ok) {
          const text = await res.text()
          throw new Error(text || `Delete failed (${res.status})`)
        }
        toast({ title: "Meeting deleted" })
        router.refresh()
      } catch (err) {
        toast({
          title: "Delete failed",
          description: err instanceof Error ? err.message : "Unexpected error",
          variant: "destructive",
        })
      }
    })
  }

  const persistNotes = (value: string) => {
    if (notesSaveTimer.current) window.clearTimeout(notesSaveTimer.current)
    setNotesStatus("saving")
    notesSaveTimer.current = window.setTimeout(async () => {
      try {
        const res = await fetch("/api/notes/current", {
          method: "PUT",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ notes: value }),
        })
        if (!res.ok) throw new Error(await res.text())
        setNotesStatus("saved")
      } catch {
        setNotesStatus("error")
      }
    }, 500)
  }

  const checkForNewMeetings = async () => {
    try {
      const res = await fetch("/api/meetings", { cache: "no-store" })
      if (!res.ok) return
      const data = (await res.json()) as Array<{ id?: string }>
      const newestId = data?.[0]?.id
      if (newestId && newestId !== lastSeenMeetingIdRef.current) {
        setLastSeenMeetingId(newestId)
        toast({ title: "New meeting received", description: "Refreshing dashboard…" })
        router.refresh()
      }
    } catch {
      // ignore polling errors
    }
  }

  return (
    <Tabs defaultValue="meetings" className="space-y-6">
      <TabsList>
        <TabsTrigger value="meetings">Meetings</TabsTrigger>
        <TabsTrigger value="voice">Voice Agent</TabsTrigger>
      </TabsList>

      <TabsContent value="meetings" className="space-y-6">
        {/* Search and Filters */}
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by summary or content..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <Filter className="h-4 w-4 text-muted-foreground" />
            <Button
              variant="outline"
              size="sm"
              onClick={() => startRefresh(() => router.refresh())}
              disabled={isRefreshing}
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${isRefreshing ? "animate-spin" : ""}`} />
              Refresh
            </Button>
            <Button
              variant={statusFilter === "all" ? "default" : "outline"}
              size="sm"
              onClick={() => setStatusFilter("all")}
            >
              All ({statusCounts.all})
            </Button>
            <Button
              variant={statusFilter === "ready" ? "default" : "outline"}
              size="sm"
              onClick={() => setStatusFilter("ready")}
            >
              Ready ({statusCounts.ready})
            </Button>
            <Button
              variant={statusFilter === "processing" ? "default" : "outline"}
              size="sm"
              onClick={() => setStatusFilter("processing")}
            >
              Processing ({statusCounts.processing})
            </Button>
            <Button
              variant={statusFilter === "failed" ? "default" : "outline"}
              size="sm"
              onClick={() => setStatusFilter("failed")}
            >
              Failed ({statusCounts.failed})
            </Button>
          </div>
        </div>

        {/* Results */}
        {filteredMeetings.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <p className="text-muted-foreground text-center">No meetings found matching your criteria.</p>
            </CardContent>
          </Card>
        ) : isMobile ? (
          <div className="space-y-4">
            {filteredMeetings.map((meeting) => (
              <Card key={meeting.id}>
                <CardContent className="p-4 space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h3 className="font-semibold">{meeting.patientDisplayName}</h3>
                      <p className="text-sm text-muted-foreground">{formatDate(meeting.createdAt)}</p>
                    </div>
                    <Badge variant={statusConfig[meeting.status].variant}>{statusConfig[meeting.status].label}</Badge>
                  </div>
                  <p className="text-sm text-muted-foreground line-clamp-2">{meeting.preview}</p>
                  <Link href={`/meetings/${meeting.id}`}>
                    <Button className="w-full" size="sm">
                      View Details
                    </Button>
                  </Link>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <Card>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Summary</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Preview</TableHead>
                  <TableHead className="text-right" />
                  <TableHead className="text-right" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredMeetings.map((meeting) => (
                  <TableRow key={meeting.id}>
                    <TableCell className="font-medium">{meeting.patientDisplayName}</TableCell>
                    <TableCell className="text-muted-foreground whitespace-nowrap">
                      {formatDate(meeting.createdAt)}
                    </TableCell>
                    <TableCell>
                      <Badge variant={statusConfig[meeting.status].variant}>{statusConfig[meeting.status].label}</Badge>
                    </TableCell>
                    <TableCell className="max-w-md">
                      <p className="line-clamp-2 text-sm text-muted-foreground">{meeting.preview}</p>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleDelete(meeting)}
                        disabled={isRefreshing}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                    <TableCell className="text-right">
                      <Link href={`/meetings/${meeting.id}`}>
                        <Button size="sm">View</Button>
                      </Link>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        )}
      </TabsContent>

      <TabsContent value="voice">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 py-2">
          <Card className="lg:col-span-2">
            <CardContent className="p-6 space-y-3">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h3 className="font-semibold">Notes</h3>
                  <p className="text-sm text-muted-foreground">
                    Type notes during the call. These are used to generate the plan when the transcript arrives.
                  </p>
                </div>
                <div className="text-xs text-muted-foreground whitespace-nowrap">
                  {notesStatus === "saving"
                    ? "Saving…"
                    : notesStatus === "saved"
                      ? "Saved"
                      : notesStatus === "error"
                        ? "Save failed"
                        : ""}
                </div>
              </div>
              <textarea
                className="min-h-[520px] w-full rounded-md border bg-background p-3 text-sm outline-none focus:ring-2 focus:ring-ring"
                placeholder="e.g. HPI, ROS, assessment, plan…"
                value={notes}
                onChange={(e) => {
                  const v = e.target.value
                  setNotes(v)
                  persistNotes(v)
                }}
              />
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => startRefresh(() => router.refresh())}
                  disabled={isRefreshing}
                >
                  <RefreshCw className={`h-4 w-4 mr-2 ${isRefreshing ? "animate-spin" : ""}`} />
                  Refresh
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => startRefresh(async () => await checkForNewMeetings())}
                  disabled={isRefreshing}
                >
                  Check for new meeting
                </Button>
              </div>
            </CardContent>
          </Card>

          <div className="flex items-start justify-center">
            <elevenlabs-convai agent-id="agent_6301kc515z2eep9tjh2exmc0h9ka" />
          </div>
        </div>
      </TabsContent>
    </Tabs>
  )
}
