import { getMeetings } from "@/lib/data"
import { MeetingsClient } from "@/components/meetings-client"

export const metadata = {
  title: "Evi Scribe",
  description: "Browse recorded meeting profiles, view transcripts, and review generated lifestyle plans.",
}

export const dynamic = "force-dynamic"

export default async function MeetingsPage() {
  const meetings = await getMeetings()

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto py-8 px-4">
        <div className="mb-8">
          <h1 className="text-3xl font-bold tracking-tight">Evi Scribe</h1>
          <p className="text-muted-foreground mt-2">
            View recorded meeting profiles, transcripts, and generated lifestyle plans.
          </p>
        </div>
        <MeetingsClient meetings={meetings} />
      </div>
    </div>
  )
}
