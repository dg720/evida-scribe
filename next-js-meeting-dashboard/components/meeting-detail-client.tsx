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
import { ChevronLeft, Copy, Download, AlertCircle, FileText, ClipboardList } from "lucide-react"
import { useToast } from "@/hooks/use-toast"

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
    if (meeting.plan) {
      const summary = generateSummary(meeting.plan)
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
            <div>
              <h1 className="text-3xl font-bold tracking-tight">{meeting.patientDisplayName}</h1>
              <p className="text-muted-foreground mt-1">{formatDate(meeting.createdAt)}</p>
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
            <Button variant="outline" size="sm" onClick={handleDownloadJSON}>
              <Download className="h-4 w-4 mr-2" />
              Download JSON
            </Button>
          </div>

          {/* Tags */}
          {meeting.tags.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {meeting.tags.map((tag) => (
                <Badge key={tag} variant="secondary">
                  {tag}
                </Badge>
              ))}
            </div>
          )}
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
              {meeting.plan ? (
                <ScrollArea className="h-[600px] pr-4">
                  <Accordion type="multiple" className="w-full">
                    {(Object.keys(domainLabels) as Array<keyof LifestylePlan>).map((domainKey) => {
                      const domain = meeting.plan![domainKey]
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
