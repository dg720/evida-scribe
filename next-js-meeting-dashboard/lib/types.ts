export type MeetingStatus = "ready" | "processing" | "failed"

export type TranscriptUtterance = {
  speaker: "coach" | "client" | "unknown"
  startTime?: number | null
  endTime?: number | null
  text: string
}

export type LifestyleDomain = {
  baseline: string
  smartGoals: string[]
  trackingKpis: string[]
  evidenceQuotes?: string[]
}

export type LifestylePlan = {
  healthyEating: LifestyleDomain
  physicalActivity: LifestyleDomain
  substances: LifestyleDomain
  stressManagement: LifestyleDomain
  sleep: LifestyleDomain
  socialConnections: LifestyleDomain
}

export type MeetingListItem = {
  id: string
  patientDisplayName: string
  createdAt: string // ISO
  status: MeetingStatus
  preview: string
  tags: string[]
  hasTranscript: boolean
  hasPlan: boolean
}

export type MeetingDetail = MeetingListItem & {
  transcript?: {
    rawText: string
    utterances: TranscriptUtterance[]
  }
  plan?: LifestylePlan
  errorMessage?: string
}
