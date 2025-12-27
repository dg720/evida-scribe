"use client"

import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { formatDate, formatTime, copyToClipboard, downloadJSON } from "@/lib/format"
import type { MeetingDetail, MeetingStatus, LifestylePlan } from "@/lib/types"
import Link from "next/link"
import { ChevronLeft, Copy, Download, AlertCircle, FileText, ClipboardList, Save, Pencil, Plus, X } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { useEffect, useMemo, useState, useTransition } from "react"
import { useRouter } from "next/navigation"

interface MeetingDetailClientProps {
  meeting: MeetingDetail
}

const statusConfig: Record<MeetingStatus, { label: string; variant: "default" | "secondary" | "destructive" }> = {
  ready: { label: "Ready", variant: "default" },
  processing: { label: "Processing", variant: "secondary" },
  failed: { label: "Failed", variant: "destructive" },
}

const domainLabels: Record<keyof LifestylePlan, string> = {
  healthyEating: "Healthy Eating",
  physicalActivity: "Physical Activity",
  substances: "Substances",
  stressManagement: "Stress Management",
  sleep: "Sleep",
  socialConnections: "Social Connections",
}

export function MeetingDetailClient({ meeting }: MeetingDetailClientProps) {
  const { toast } = useToast()
  const router = useRouter()
  const [isEditing, setIsEditing] = useState(false)
  const [isSaving, startSave] = useTransition()
  const [isEditingTitle, setIsEditingTitle] = useState(false)
  const [isSavingTitle, startTitleSave] = useTransition()
  const [titleDraft, setTitleDraft] = useState(meeting.patientDisplayName)

  const initialPlan = useMemo(() => {
    return meeting.plan ?? null
  }, [meeting.plan])

  // Local display copy so the UI reflects edits immediately after saving,
  // even before a server refresh pulls the updated plan from the backend.
  const [displayPlan, setDisplayPlan] = useState<LifestylePlan | null>(initialPlan)
  const [editablePlan, setEditablePlan] = useState<LifestylePlan | null>(initialPlan)

  useEffect(() => {
    setEditablePlan(initialPlan)
    setDisplayPlan(initialPlan)
    setTitleDraft(meeting.patientDisplayName)
    setIsEditingTitle(false)
  }, [initialPlan, meeting.patientDisplayName])

  const handleSaveTitle = () => {
    const nextTitle = titleDraft.trim()
    if (!nextTitle) {
      toast({ title: "Title cannot be empty", variant: "destructive" })
      return
    }
    startTitleSave(async () => {
      try {
        const res = await fetch(`/api/meetings/${encodeURIComponent(meeting.id)}/meta`, {
          method: "PUT",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ patientDisplayName: nextTitle }),
        })
        if (!res.ok) throw new Error(await res.text())
        toast({ title: "Title updated" })
        setIsEditingTitle(false)
        router.refresh()
      } catch (err) {
        toast({
          title: "Update failed",
          description: err instanceof Error ? err.message : "Unexpected error",
          variant: "destructive",
        })
      }
    })
  }

  const handleCopyTranscript = () => {
    if (meeting.transcript) {
      copyToClipboard(meeting.transcript.rawText)
      toast({
        title: "Copied to clipboard",
        description: "Transcript copied successfully",
      })
    }
  }

  const handleCopySummary = () => {
    if (displayPlan) {
      const summary = generateSummary(displayPlan)
      copyToClipboard(summary)
      toast({
        title: "Copied to clipboard",
        description: "Summary copied successfully",
      })
    }
  }

  const handleDownloadJSON = () => {
    downloadJSON(meeting, `meeting-${meeting.id}.json`)
    toast({
      title: "Download started",
      description: "Meeting data downloaded as JSON",
    })
  }

  const handleSavePlan = () => {
    if (!editablePlan) return
    startSave(async () => {
      try {
        const res = await fetch(`/api/meetings/${encodeURIComponent(meeting.id)}/plan`, {
          method: "PUT",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ plan: editablePlan }),
        })
        if (!res.ok) throw new Error(await res.text())
        toast({ title: "Plan saved" })
        setIsEditing(false)
        setDisplayPlan(editablePlan)
        router.refresh()
      } catch (err) {
        toast({
          title: "Save failed",
          description: err instanceof Error ? err.message : "Unexpected error",
          variant: "destructive",
        })
      }
    })
  }

  const updateDomain = (key: keyof LifestylePlan, patch: Partial<LifestylePlan[keyof LifestylePlan]>) => {
    setEditablePlan((prev) => {
      if (!prev) return prev
      return { ...prev, [key]: { ...prev[key], ...patch } }
    })
  }

  const addListItem = (key: keyof LifestylePlan, field: "smartGoals" | "trackingKpis") => {
    setEditablePlan((prev) => {
      if (!prev) return prev
      const domain = prev[key]
      return { ...prev, [key]: { ...domain, [field]: [...domain[field], ""] } }
    })
  }

  const removeListItem = (key: keyof LifestylePlan, field: "smartGoals" | "trackingKpis", index: number) => {
    setEditablePlan((prev) => {
      if (!prev) return prev
      const domain = prev[key]
      return { ...prev, [key]: { ...domain, [field]: domain[field].filter((_, i) => i !== index) } }
    })
  }

  const updateListItem = (
    key: keyof LifestylePlan,
    field: "smartGoals" | "trackingKpis",
    index: number,
    value: string,
  ) => {
    setEditablePlan((prev) => {
      if (!prev) return prev
      const domain = prev[key]
      const next = [...domain[field]]
      next[index] = value
      return { ...prev, [key]: { ...domain, [field]: next } }
    })
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto py-6 px-4 max-w-7xl">
        {/* Breadcrumb */}
        <div className="mb-6">
          <Link
            href="/meetings"
            className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <ChevronLeft className="h-4 w-4 mr-1" />
            Back to Meetings
          </Link>
        </div>

        {/* Header */}
        <div className="mb-6 space-y-4">
          <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div className="space-y-2">
              {isEditingTitle ? (
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                  <input
                    className="w-full max-w-xl rounded-md border bg-background px-3 py-2 text-base font-semibold outline-none focus:ring-2 focus:ring-ring"
                    value={titleDraft}
                    onChange={(e) => setTitleDraft(e.target.value)}
                  />
                  <div className="flex gap-2">
                    <Button size="sm" onClick={handleSaveTitle} disabled={isSavingTitle}>
                      {isSavingTitle ? "Saving..." : "Save"}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setTitleDraft(meeting.patientDisplayName)
                        setIsEditingTitle(false)
                      }}
                      disabled={isSavingTitle}
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <h1 className="text-3xl font-bold tracking-tight">{meeting.patientDisplayName}</h1>
                  <Button variant="ghost" size="sm" onClick={() => setIsEditingTitle(true)}>
                    <Pencil className="h-4 w-4 mr-2" />
                    Edit Title
                  </Button>
                </div>
              )}
              <p className="text-muted-foreground">{formatDate(meeting.createdAt)}</p>
            </div>
            <Badge variant={statusConfig[meeting.status].variant} className="self-start">
              {statusConfig[meeting.status].label}
            </Badge>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={handleCopyTranscript} disabled={!meeting.transcript}>
              <Copy className="h-4 w-4 mr-2" />
              Copy Transcript
            </Button>
            <Button variant="outline" size="sm" onClick={handleCopySummary} disabled={!meeting.plan}>
              <FileText className="h-4 w-4 mr-2" />
              Copy Summary
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setIsEditing((v) => !v)
                setEditablePlan(initialPlan)
              }}
              disabled={!meeting.plan}
            >
              <Pencil className="h-4 w-4 mr-2" />
              {isEditing ? "Cancel Edit" : "Edit Plan"}
            </Button>
            {isEditing && (
              <Button variant="default" size="sm" onClick={handleSavePlan} disabled={isSaving}>
                <Save className="h-4 w-4 mr-2" />
                {isSaving ? "Saving..." : "Save Plan"}
              </Button>
            )}
            <Button variant="outline" size="sm" onClick={handleDownloadJSON}>
              <Download className="h-4 w-4 mr-2" />
              Download JSON
            </Button>
          </div>

          {/* Tags intentionally hidden for now (not wired to meaningful metadata yet). */}
        </div>

        {/* Error Alert */}
        {meeting.status === "failed" && (
          <Alert variant="destructive" className="mb-6">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Processing Failed</AlertTitle>
            <AlertDescription>
              {meeting.errorMessage || "An error occurred while processing this meeting."}
            </AlertDescription>
          </Alert>
        )}

        {/* Two Column Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Plan Panel */}
          <Card className="lg:sticky lg:top-6 lg:self-start">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ClipboardList className="h-5 w-5" />
                Lifestyle Plan
              </CardTitle>
            </CardHeader>
            <CardContent>
              {displayPlan && !isEditing ? (
                <ScrollArea className="h-[600px] pr-4">
                  <Accordion type="multiple" className="w-full">
                    {(Object.keys(domainLabels) as Array<keyof LifestylePlan>).map((domainKey) => {
                      const domain = displayPlan[domainKey]
                      return (
                        <AccordionItem key={domainKey} value={domainKey}>
                          <AccordionTrigger className="text-left">{domainLabels[domainKey]}</AccordionTrigger>
                          <AccordionContent>
                            <div className="space-y-4 pt-2">
                              <div>
                                <h4 className="font-semibold text-sm mb-2">Baseline</h4>
                                <p className="text-sm text-muted-foreground leading-relaxed">{domain.baseline}</p>
                              </div>

                              {domain.smartGoals.length > 0 && (
                                <div>
                                  <h4 className="font-semibold text-sm mb-2">SMART Goals</h4>
                                  <ul className="space-y-2">
                                    {domain.smartGoals.map((goal, idx) => (
                                      <li key={idx} className="text-sm text-muted-foreground leading-relaxed flex">
                                        <span className="mr-2">•</span>
                                        <span>{goal}</span>
                                      </li>
                                    ))}
                                  </ul>
                                </div>
                              )}

                              {domain.trackingKpis.length > 0 && (
                                <div>
                                  <h4 className="font-semibold text-sm mb-2">Tracking KPIs</h4>
                                  <ul className="space-y-2">
                                    {domain.trackingKpis.map((kpi, idx) => (
                                      <li key={idx} className="text-sm text-muted-foreground leading-relaxed flex">
                                        <span className="mr-2">•</span>
                                        <span>{kpi}</span>
                                      </li>
                                    ))}
                                  </ul>
                                </div>
                              )}

                              {domain.evidenceQuotes && domain.evidenceQuotes.length > 0 && (
                                <div>
                                  <h4 className="font-semibold text-sm mb-2">Evidence Quotes</h4>
                                  <div className="space-y-2">
                                    {domain.evidenceQuotes.map((quote, idx) => (
                                      <blockquote
                                        key={idx}
                                        className="border-l-2 border-muted pl-3 text-sm text-muted-foreground italic"
                                      >
                                        "{quote}"
                                      </blockquote>
                                    ))}
                                  </div>
                                </div>
                              )}
                            </div>
                          </AccordionContent>
                        </AccordionItem>
                      )
                    })}
                  </Accordion>
                </ScrollArea>
              ) : editablePlan && isEditing ? (
                <ScrollArea className="h-[600px] pr-4">
                  <Accordion type="multiple" className="w-full">
                    {(Object.keys(domainLabels) as Array<keyof LifestylePlan>).map((domainKey) => {
                      const domain = editablePlan[domainKey]
                      return (
                        <AccordionItem key={domainKey} value={domainKey}>
                          <AccordionTrigger className="text-left">{domainLabels[domainKey]}</AccordionTrigger>
                          <AccordionContent>
                            <div className="space-y-4 pt-2">
                              <div className="space-y-2">
                                <h4 className="font-semibold text-sm">Baseline</h4>
                                <textarea
                                  className="w-full min-h-[110px] rounded-md border bg-background p-2 text-sm outline-none focus:ring-2 focus:ring-ring"
                                  value={domain.baseline}
                                  onChange={(e) => updateDomain(domainKey, { baseline: e.target.value })}
                                />
                              </div>

                              <div className="space-y-2">
                                <div className="flex items-center justify-between">
                                  <h4 className="font-semibold text-sm">SMART Goals</h4>
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => addListItem(domainKey, "smartGoals")}
                                  >
                                    <Plus className="h-4 w-4 mr-2" />
                                    Add
                                  </Button>
                                </div>
                                {domain.smartGoals.length === 0 ? (
                                  <p className="text-sm text-muted-foreground">No goals yet.</p>
                                ) : (
                                  <div className="space-y-2">
                                    {domain.smartGoals.map((goal, idx) => (
                                      <div key={idx} className="flex gap-2">
                                        <input
                                          className="flex-1 rounded-md border bg-background px-2 py-1 text-sm outline-none focus:ring-2 focus:ring-ring"
                                          value={goal}
                                          onChange={(e) =>
                                            updateListItem(domainKey, "smartGoals", idx, e.target.value)
                                          }
                                          placeholder="e.g. Walk 10 minutes after lunch, 3x/week"
                                        />
                                        <Button
                                          variant="outline"
                                          size="sm"
                                          onClick={() => removeListItem(domainKey, "smartGoals", idx)}
                                          aria-label="Remove goal"
                                        >
                                          <X className="h-4 w-4" />
                                        </Button>
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>

                              <div className="space-y-2">
                                <div className="flex items-center justify-between">
                                  <h4 className="font-semibold text-sm">Tracking KPIs</h4>
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => addListItem(domainKey, "trackingKpis")}
                                  >
                                    <Plus className="h-4 w-4 mr-2" />
                                    Add
                                  </Button>
                                </div>
                                {domain.trackingKpis.length === 0 ? (
                                  <p className="text-sm text-muted-foreground">No KPIs yet.</p>
                                ) : (
                                  <div className="space-y-2">
                                    {domain.trackingKpis.map((kpi, idx) => (
                                      <div key={idx} className="flex gap-2">
                                        <input
                                          className="flex-1 rounded-md border bg-background px-2 py-1 text-sm outline-none focus:ring-2 focus:ring-ring"
                                          value={kpi}
                                          onChange={(e) =>
                                            updateListItem(domainKey, "trackingKpis", idx, e.target.value)
                                          }
                                          placeholder="e.g. Steps per day"
                                        />
                                        <Button
                                          variant="outline"
                                          size="sm"
                                          onClick={() => removeListItem(domainKey, "trackingKpis", idx)}
                                          aria-label="Remove KPI"
                                        >
                                          <X className="h-4 w-4" />
                                        </Button>
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>
                            </div>
                          </AccordionContent>
                        </AccordionItem>
                      )
                    })}
                  </Accordion>
                </ScrollArea>
              ) : (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <ClipboardList className="h-12 w-12 text-muted-foreground/50 mb-3" />
                  <p className="text-muted-foreground">
                    {meeting.status === "processing"
                      ? "Plan is being generated..."
                      : "No lifestyle plan available for this meeting."}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Transcript Panel */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Transcript
              </CardTitle>
            </CardHeader>
            <CardContent>
              {meeting.transcript ? (
                <Tabs defaultValue="formatted" className="w-full">
                  <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="formatted">Formatted</TabsTrigger>
                    <TabsTrigger value="raw">Raw Text</TabsTrigger>
                  </TabsList>
                  <TabsContent value="formatted" className="mt-4">
                    <ScrollArea className="h-[600px] pr-4">
                      <div className="space-y-4">
                        {meeting.transcript.utterances.map((utterance, idx) => (
                          <div key={idx} className="space-y-1">
                            <div className="flex items-center gap-2 text-xs">
                              <Badge
                                variant={utterance.speaker === "coach" ? "default" : "secondary"}
                                className="capitalize"
                              >
                                {utterance.speaker}
                              </Badge>
                              {(utterance.startTime != null || utterance.endTime != null) && (
                                <span className="text-muted-foreground">
                                  {formatTime(utterance.startTime)} - {formatTime(utterance.endTime)}
                                </span>
                              )}
                            </div>
                            <p className="text-sm leading-relaxed pl-2 border-l-2 border-muted">{utterance.text}</p>
                          </div>
                        ))}
                      </div>
                    </ScrollArea>
                  </TabsContent>
                  <TabsContent value="raw" className="mt-4">
                    <ScrollArea className="h-[600px] pr-4">
                      <pre className="text-sm leading-relaxed whitespace-pre-wrap font-mono text-muted-foreground">
                        {meeting.transcript.rawText}
                      </pre>
                    </ScrollArea>
                  </TabsContent>
                </Tabs>
              ) : (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <FileText className="h-12 w-12 text-muted-foreground/50 mb-3" />
                  <p className="text-muted-foreground">No transcript available for this meeting.</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}

function generateSummary(plan: LifestylePlan): string {
  let summary = "Lifestyle Plan Summary\n\n"
  ;(Object.keys(domainLabels) as Array<keyof LifestylePlan>).forEach((domainKey) => {
    const domain = plan[domainKey]
    summary += `${domainLabels[domainKey]}\n`
    summary += `${"=".repeat(domainLabels[domainKey].length)}\n\n`
    summary += `Baseline: ${domain.baseline}\n\n`

    if (domain.smartGoals.length > 0) {
      summary += "Goals:\n"
      domain.smartGoals.forEach((goal) => {
        summary += `  • ${goal}\n`
      })
      summary += "\n"
    }

    if (domain.trackingKpis.length > 0) {
      summary += "Tracking KPIs:\n"
      domain.trackingKpis.forEach((kpi) => {
        summary += `  • ${kpi}\n`
      })
      summary += "\n"
    }

    summary += "\n"
  })

  return summary
}
