import { notFound } from "next/navigation"
import { getMeeting } from "@/lib/data"
import { MeetingDetailClient } from "@/components/meeting-detail-client"

export const dynamic = "force-dynamic"

export default async function MeetingDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const meeting = await getMeeting(id)

  if (!meeting) {
    notFound()
  }

  return <MeetingDetailClient meeting={meeting} />
}
