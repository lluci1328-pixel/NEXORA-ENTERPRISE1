import { resolvePageContext } from "@/lib/page-context";
import { prisma } from "@/lib/db";
import { PageHeading, Card, CardHeader, EmptyState } from "@/components/ui/primitives";
import { CallList } from "./call-list";
import { formatNumber, formatDuration } from "@/lib/utils";
import { PhoneIncoming, PhoneOutgoing, PhoneMissed, Clock } from "lucide-react";

export default async function CallsPage({ params }: { params: Promise<{ business: string }> }) {
  const { business } = await resolvePageContext((await params).business);

  const calls = await prisma.call.findMany({
    where: { businessId: business.id },
    include: { contact: true, handledBy: true, transferredTo: true },
    orderBy: { startedAt: "desc" },
    take: 50,
  });

  const inbound = calls.filter((c) => c.direction === "INBOUND").length;
  const outbound = calls.filter((c) => c.direction === "OUTBOUND").length;
  const missed = calls.filter((c) => c.status === "MISSED").length;
  const avgDuration =
    calls.filter((c) => c.durationSec > 0).reduce((s, c) => s + c.durationSec, 0) /
    (calls.filter((c) => c.durationSec > 0).length || 1);

  const stats = [
    { label: "Inbound", value: formatNumber(inbound), icon: PhoneIncoming, tone: "bg-primary-softer text-primary" },
    { label: "Outbound", value: formatNumber(outbound), icon: PhoneOutgoing, tone: "bg-purple-soft text-purple" },
    { label: "Missed", value: formatNumber(missed), icon: PhoneMissed, tone: "bg-danger-soft text-danger" },
    { label: "Avg Duration", value: formatDuration(Math.round(avgDuration)), icon: Clock, tone: "bg-success-soft text-success" },
  ];

  return (
    <div className="space-y-6">
      <PageHeading title="Calls" description="Voice AI — inbound, outbound, recordings, transcripts and summaries" />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((s) => (
          <Card key={s.label} className="flex items-center gap-3 p-4">
            <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${s.tone}`}>
              <s.icon size={18} />
            </div>
            <div>
              <p className="text-xl font-bold text-text stat-value">{s.value}</p>
              <p className="text-xs text-text-muted">{s.label}</p>
            </div>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader title="Call Log" subtitle="Click a call to view its AI summary and transcript" />
        {calls.length === 0 ? (
          <EmptyState icon={<PhoneIncoming size={20} />} title="No calls yet" description="Voice AI calls will appear here once your telephony workflow is connected." />
        ) : (
          <CallList
            calls={calls.map((c) => ({
              id: c.id,
              direction: c.direction,
              status: c.status,
              contactName: c.contact ? `${c.contact.firstName} ${c.contact.lastName ?? ""}`.trim() : "Unknown caller",
              contactPhone: c.contact?.phone ?? null,
              durationSec: c.durationSec,
              outcome: c.outcome,
              sentiment: c.sentiment,
              aiSummary: c.aiSummary,
              transcript: c.transcript,
              agentName: c.handledBy?.name ?? null,
              transferredTo: c.transferredTo?.name ?? null,
              startedAt: c.startedAt.toISOString(),
            }))}
          />
        )}
      </Card>
    </div>
  );
}
