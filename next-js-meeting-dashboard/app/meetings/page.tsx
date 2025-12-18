import { getMeetings } from "@/lib/data"
import { MeetingsClient } from "@/components/meetings-client"

export const metadata = {
  title: "Meeting Profiles",
  description: "View and manage meeting profiles",
}

export const dynamic = "force-dynamic"

export default async function MeetingsPage() {
  const meetings = await getMeetings()

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto py-8 px-4">
        <div className="mb-8">
          <h1 className="text-3xl font-bold tracking-tight">Meeting Profiles</h1>
          <p className="text-muted-foreground mt-2">View and manage all meeting profiles and lifestyle plans</p>
        </div>
        <MeetingsClient meetings={meetings} />
      </div>
    </div>
  )
}
