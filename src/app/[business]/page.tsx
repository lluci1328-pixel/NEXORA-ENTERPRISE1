import Link from "next/link";
import { resolvePageContext } from "@/lib/page-context";
import { getDashboardSnapshot, getRevenueTrend, getRecentActivity } from "@/lib/queries";
import { prisma } from "@/lib/db";
import { StatCard } from "@/components/ui/stat-card";
import { Card, CardHeader, Avatar, Badge, EmptyState } from "@/components/ui/primitives";
import { RevenueAreaChart } from "@/components/ui/charts";
import { ConversationStatusBadge } from "@/components/ui/badges";
import { formatCompactCurrency, formatNumber, timeAgo } from "@/lib/utils";
import {
  IndianRupee,
  Users,
  CalendarCheck,
  MessagesSquare,
  Flame,
  Bot,
  ArrowRight,
  Activity as ActivityIcon,
  Sparkles,
} from "lucide-react";

export default async function DashboardPage({ params }: { params: Promise<{ business: string }> }) {
  const { business } = await resolvePageContext((await params).business);
  const [snap, trend, activity, upcoming] = await Promise.all([
    getDashboardSnapshot(business.id),
    getRevenueTrend(business.id, 30),
    getRecentActivity(business.id, 10),
    prisma.appointment.findMany({
      where: { businessId: business.id, scheduledAt: { gte: new Date() }, status: { in: ["SCHEDULED", "CONFIRMED"] } },
      include: { contact: true },
      orderBy: { scheduledAt: "asc" },
      take: 5,
    }),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-text">{business.name}</h1>
        <p className="mt-1 text-sm text-text-secondary">
          Operations overview · last 30 days performance
        </p>
      </div>

      {/* Stat row */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Revenue (30d)"
          value={formatCompactCurrency(snap.revenue30, business.currency)}
          icon={<IndianRupee size={18} />}
          change={snap.changes.revenue}
          tone="success"
          hint={`${snap.dealsWon30} deals won`}
        />
        <StatCard
          label="New Leads (30d)"
          value={formatNumber(Math.round(snap.metrics.NEW_LEADS ?? 0))}
          icon={<Users size={18} />}
          change={snap.changes.leads}
          tone="primary"
          hint={`${snap.todayLeads} today`}
        />
        <StatCard
          label="Conversations (30d)"
          value={formatNumber(Math.round(snap.metrics.CONVERSATIONS ?? 0))}
          icon={<MessagesSquare size={18} />}
          change={snap.changes.conversations}
          tone="purple"
          hint={`${snap.openConversations} open now`}
        />
        <StatCard
          label="Appointments (30d)"
          value={formatNumber(Math.round(snap.metrics.APPOINTMENTS ?? 0))}
          icon={<CalendarCheck size={18} />}
          change={snap.changes.appointments}
          tone="accent"
          hint={`${snap.upcomingAppointments} upcoming`}
        />
      </div>

      {/* Secondary row */}
      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader
            title="Revenue Trend"
            subtitle="Daily closed-deal value over the last 30 days"
            icon={<IndianRupee size={16} />}
          />
          <div className="px-3 pb-4 pt-2">
            <RevenueAreaChart data={trend} currency={business.currency} />
          </div>
        </Card>

        <div className="space-y-4">
          <div className="card p-5">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-danger-soft text-danger">
                <Flame size={18} />
              </div>
              <div>
                <p className="text-2xl font-bold text-text stat-value">{snap.hotLeads}</p>
                <p className="text-[13px] font-medium text-text-secondary">Hot leads to action</p>
              </div>
            </div>
            <Link href={`/${business.slug}/crm/leads?filter=hot`} className="mt-3 flex items-center gap-1 text-xs font-semibold text-primary hover:text-primary-hover">
              View hot leads <ArrowRight size={13} />
            </Link>
          </div>

          <div className="card p-5">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary-softer text-primary">
                <Bot size={18} />
              </div>
              <div>
                <p className="text-2xl font-bold text-text stat-value">
                  {snap.activeAgents}<span className="text-base text-text-muted">/{snap.totalAgents}</span>
                </p>
                <p className="text-[13px] font-medium text-text-secondary">AI agents active</p>
              </div>
            </div>
            <Link href={`/${business.slug}/agents`} className="mt-3 flex items-center gap-1 text-xs font-semibold text-primary hover:text-primary-hover">
              Manage agents <ArrowRight size={13} />
            </Link>
          </div>

          <div className="card bg-gradient-to-br from-primary to-accent p-5 text-white">
            <div className="flex items-center gap-2">
              <Sparkles size={16} />
              <p className="text-sm font-semibold">AI handled {formatNumber(Math.round(snap.metrics.AI_MESSAGES ?? 0))} messages</p>
            </div>
            <p className="mt-1 text-xs text-white/75">
              Across all channels this month — freeing your team for high-value work.
            </p>
          </div>
        </div>
      </div>

      {/* Live monitor + activity + appointments */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Live conversations */}
        <Card className="lg:col-span-2">
          <CardHeader
            title="Live Conversation Monitor"
            subtitle="Active AI & human conversations right now"
            icon={<MessagesSquare size={16} />}
            action={
              <Link href={`/${business.slug}/inbox`} className="btn btn-ghost py-1.5 text-xs">
                Open Inbox
              </Link>
            }
          />
          <div className="mt-2 divide-y divide-border">
            {snap.liveConversations.length === 0 ? (
              <EmptyState icon={<MessagesSquare size={20} />} title="No active conversations" description="New customer messages will appear here in real time." />
            ) : (
              snap.liveConversations.map((c) => (
                <Link
                  key={c.id}
                  href={`/${business.slug}/inbox?c=${c.id}`}
                  className="flex items-center gap-3 px-5 py-3 transition-colors hover:bg-surface-muted"
                >
                  <Avatar name={`${c.contact.firstName} ${c.contact.lastName ?? ""}`} size={38} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="truncate text-sm font-semibold text-text">
                        {c.contact.firstName} {c.contact.lastName ?? ""}
                      </p>
                      <ConversationStatusBadge status={c.status} />
                    </div>
                    <p className="truncate text-xs text-text-muted">
                      {c.messages[0]?.body ?? "No messages yet"}
                    </p>
                  </div>
                  <span className="shrink-0 text-[11px] text-text-muted">{timeAgo(c.lastMessageAt)}</span>
                </Link>
              ))
            )}
          </div>
        </Card>

        {/* Upcoming appointments */}
        <Card>
          <CardHeader title="Upcoming Appointments" icon={<CalendarCheck size={16} />} />
          <div className="mt-2 divide-y divide-border">
            {upcoming.length === 0 ? (
              <EmptyState icon={<CalendarCheck size={20} />} title="Nothing scheduled" />
            ) : (
              upcoming.map((a) => (
                <div key={a.id} className="flex items-start gap-3 px-5 py-3">
                  <div className="flex h-10 w-10 shrink-0 flex-col items-center justify-center rounded-lg bg-primary-softer text-primary">
                    <span className="text-[10px] font-semibold uppercase leading-none">
                      {a.scheduledAt.toLocaleDateString("en-US", { month: "short" })}
                    </span>
                    <span className="text-sm font-bold leading-tight">{a.scheduledAt.getDate()}</span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13px] font-semibold text-text">{a.title}</p>
                    <p className="text-xs text-text-muted">
                      {a.scheduledAt.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })} ·{" "}
                      {a.contact.firstName}
                    </p>
                  </div>
                  {a.bookedByType === "AI_AGENT" && <Badge tone="primary">AI</Badge>}
                </div>
              ))
            )}
          </div>
        </Card>
      </div>

      {/* Recent activity */}
      <Card>
        <CardHeader title="Recent Activity" subtitle="Everything happening across the business" icon={<ActivityIcon size={16} />} />
        <div className="mt-2 divide-y divide-border">
          {activity.map((a) => (
            <div key={a.id} className="flex items-center gap-3 px-5 py-3">
              <span
                className="h-2 w-2 shrink-0 rounded-full"
                style={{ background: a.actorType === "AI_AGENT" ? "var(--primary)" : a.actorType === "USER" ? "var(--purple)" : "var(--text-muted)" }}
              />
              <div className="min-w-0 flex-1">
                <p className="truncate text-[13px] text-text">
                  <span className="font-semibold">{a.title}</span>
                  {a.contact && <span className="text-text-muted"> · {a.contact.firstName}</span>}
                </p>
              </div>
              <div className="flex items-center gap-2">
                {a.actorType === "AI_AGENT" && <Badge tone="primary">AI</Badge>}
                <span className="shrink-0 text-[11px] text-text-muted">{timeAgo(a.createdAt)}</span>
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
