import { resolvePageContext } from "@/lib/page-context";
import { prisma } from "@/lib/db";
import { PageHeading, Card, Avatar, Badge } from "@/components/ui/primitives";
import { titleCase } from "@/lib/utils";
import { MapPin, Bot, Clock } from "lucide-react";

export default async function AppointmentsPage({ params }: { params: Promise<{ business: string }> }) {
  const { business } = await resolvePageContext((await params).business);

  const [upcoming, past] = await Promise.all([
    prisma.appointment.findMany({
      where: { businessId: business.id, scheduledAt: { gte: new Date() } },
      include: { contact: true, assignedTo: true },
      orderBy: { scheduledAt: "asc" },
    }),
    prisma.appointment.findMany({
      where: { businessId: business.id, scheduledAt: { lt: new Date() } },
      include: { contact: true, assignedTo: true },
      orderBy: { scheduledAt: "desc" },
      take: 20,
    }),
  ]);

  const statusTone: Record<string, "primary" | "success" | "warning" | "danger" | "neutral"> = {
    SCHEDULED: "primary",
    CONFIRMED: "success",
    COMPLETED: "neutral",
    CANCELLED: "danger",
    NO_SHOW: "warning",
  };

  const Item = ({ a }: { a: (typeof upcoming)[number] }) => (
    <div className="flex items-center gap-4 px-5 py-3.5">
      <div className="flex h-12 w-12 shrink-0 flex-col items-center justify-center rounded-xl bg-primary-softer text-primary">
        <span className="text-[10px] font-semibold uppercase leading-none">
          {a.scheduledAt.toLocaleDateString("en-US", { month: "short" })}
        </span>
        <span className="text-base font-bold leading-tight">{a.scheduledAt.getDate()}</span>
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[13px] font-semibold text-text">{a.title}</p>
        <div className="mt-0.5 flex flex-wrap items-center gap-3 text-xs text-text-muted">
          <span className="flex items-center gap-1">
            <Clock size={11} />
            {a.scheduledAt.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}
          </span>
          {a.location && <span className="flex items-center gap-1"><MapPin size={11} /> {a.location}</span>}
          <span>· {a.contact.firstName} {a.contact.lastName ?? ""}</span>
        </div>
      </div>
      <div className="flex items-center gap-2">
        {a.bookedByType === "AI_AGENT" && (
          <span className="flex items-center gap-1 text-[11px] text-primary"><Bot size={12} /> AI booked</span>
        )}
        <Badge tone="neutral">{titleCase(a.type)}</Badge>
        <Badge tone={statusTone[a.status] ?? "neutral"}>{titleCase(a.status)}</Badge>
        {a.assignedTo && <Avatar name={a.assignedTo.name} size={26} tone="neutral" />}
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      <PageHeading title="Appointments" description={`${upcoming.length} upcoming`} />

      <Card>
        <p className="border-b border-border px-5 py-3 text-xs font-semibold uppercase tracking-wide text-text-muted">
          Upcoming
        </p>
        <div className="divide-y divide-border">
          {upcoming.length === 0 ? (
            <p className="px-5 py-8 text-center text-sm text-text-muted">No upcoming appointments.</p>
          ) : (
            upcoming.map((a) => <Item key={a.id} a={a} />)
          )}
        </div>
      </Card>

      <Card>
        <p className="border-b border-border px-5 py-3 text-xs font-semibold uppercase tracking-wide text-text-muted">
          Past
        </p>
        <div className="divide-y divide-border opacity-80">
          {past.map((a) => <Item key={a.id} a={a} />)}
        </div>
      </Card>
    </div>
  );
}
