"use client"

import { useMemo, useState, useTransition } from "react"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { formatDate } from "@/lib/format"
import type { MeetingListItem, MeetingStatus } from "@/lib/types"
import Link from "next/link"
import { Filter, RefreshCw, Search } from "lucide-react"
import { useRouter } from "next/navigation"
import { useMobile } from "@/hooks/use-mobile"

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

  return (
    <div className="space-y-6">
      {/* Search and Filters */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by name or content..."
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
                <TableHead>Patient</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Preview</TableHead>
                <TableHead className="text-right">Actions</TableHead>
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
    </div>
  )
}
