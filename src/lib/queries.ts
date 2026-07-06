import "server-only";
import { prisma } from "./db";

/**
 * Tenancy-scoped read layer. Every function takes a businessId and filters by
 * it — pages never query Prisma directly, which keeps the data-isolation
 * guarantee in one auditable place.
 */

function startOfUtcDay(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

function daysAgo(n: number): Date {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d;
}

// --- Dashboard --------------------------------------------------------------

export async function getDashboardSnapshot(businessId: string) {
  const todayStart = startOfUtcDay(new Date());
  const last30 = startOfUtcDay(daysAgo(30));
  const prev30 = startOfUtcDay(daysAgo(60));

  const [
    todayLeads,
    openConversations,
    upcomingAppointments,
    activeAgents,
    totalAgents,
    hotLeads,
    wonThisMonth,
    metrics30,
    metricsPrev30,
    liveConversations,
  ] = await Promise.all([
    prisma.lead.count({ where: { businessId, createdAt: { gte: todayStart } } }),
    prisma.conversation.count({
      where: { businessId, status: { in: ["OPEN", "AI_HANDLING", "HUMAN_TAKEOVER"] } },
    }),
    prisma.appointment.count({
      where: { businessId, scheduledAt: { gte: new Date() }, status: { in: ["SCHEDULED", "CONFIRMED"] } },
    }),
    prisma.aiAgent.count({ where: { businessId, status: "ACTIVE" } }),
    prisma.aiAgent.count({ where: { businessId } }),
    prisma.lead.count({ where: { businessId, score: { gte: 85 }, status: { notIn: ["LOST", "CONVERTED"] } } }),
    prisma.deal.aggregate({
      where: { businessId, status: "WON", wonAt: { gte: last30 } },
      _sum: { value: true },
      _count: true,
    }),
    prisma.dailyMetric.groupBy({
      by: ["metric"],
      where: { businessId, date: { gte: last30 } },
      _sum: { value: true },
    }),
    prisma.dailyMetric.groupBy({
      by: ["metric"],
      where: { businessId, date: { gte: prev30, lt: last30 } },
      _sum: { value: true },
    }),
    prisma.conversation.findMany({
      where: { businessId, status: { in: ["AI_HANDLING", "HUMAN_TAKEOVER"] } },
      include: { contact: true, aiAgent: true, messages: { orderBy: { createdAt: "desc" }, take: 1 } },
      orderBy: { lastMessageAt: "desc" },
      take: 6,
    }),
  ]);

  const metricMap = (rows: { metric: string; _sum: { value: number | null } }[]) =>
    Object.fromEntries(rows.map((r) => [r.metric, r._sum.value ?? 0]));
  const cur = metricMap(metrics30);
  const prev = metricMap(metricsPrev30);

  const pctChange = (c: number, p: number) => (p === 0 ? (c > 0 ? 100 : 0) : ((c - p) / p) * 100);

  return {
    todayLeads,
    openConversations,
    upcomingAppointments,
    activeAgents,
    totalAgents,
    hotLeads,
    revenue30: wonThisMonth._sum.value ?? 0,
    dealsWon30: wonThisMonth._count,
    metrics: cur,
    changes: {
      revenue: pctChange(cur.REVENUE ?? 0, prev.REVENUE ?? 0),
      leads: pctChange(cur.NEW_LEADS ?? 0, prev.NEW_LEADS ?? 0),
      conversations: pctChange(cur.CONVERSATIONS ?? 0, prev.CONVERSATIONS ?? 0),
      appointments: pctChange(cur.APPOINTMENTS ?? 0, prev.APPOINTMENTS ?? 0),
    },
    liveConversations,
  };
}

export async function getRevenueTrend(businessId: string, days = 30) {
  const since = startOfUtcDay(daysAgo(days));
  const rows = await prisma.dailyMetric.findMany({
    where: { businessId, date: { gte: since }, metric: { in: ["REVENUE", "NEW_LEADS", "DEALS_WON"] } },
    orderBy: { date: "asc" },
  });
  const byDate = new Map<string, { date: string; revenue: number; leads: number; deals: number }>();
  for (const r of rows) {
    const key = r.date.toISOString().slice(0, 10);
    const entry = byDate.get(key) ?? { date: key, revenue: 0, leads: 0, deals: 0 };
    if (r.metric === "REVENUE") entry.revenue = r.value;
    if (r.metric === "NEW_LEADS") entry.leads = r.value;
    if (r.metric === "DEALS_WON") entry.deals = r.value;
    byDate.set(key, entry);
  }
  return [...byDate.values()];
}

export async function getRecentActivity(businessId: string, take = 12) {
  return prisma.activity.findMany({
    where: { businessId },
    include: { actor: true, contact: true },
    orderBy: { createdAt: "desc" },
    take,
  });
}

// --- Analytics --------------------------------------------------------------

export async function getAnalytics(businessId: string, days = 30) {
  const since = startOfUtcDay(daysAgo(days));
  const [metrics, leadSources, agentPerf, callStats, dealsByStage, teamPerf] = await Promise.all([
    prisma.dailyMetric.findMany({
      where: { businessId, date: { gte: since } },
      orderBy: { date: "asc" },
    }),
    prisma.lead.groupBy({
      by: ["source"],
      where: { businessId, createdAt: { gte: since } },
      _count: true,
    }),
    prisma.agentRun.groupBy({
      by: ["agentId"],
      where: { businessId, createdAt: { gte: since } },
      _count: true,
      _sum: { tokensUsed: true },
      _avg: { durationMs: true },
    }),
    prisma.call.groupBy({
      by: ["outcome"],
      where: { businessId, startedAt: { gte: since } },
      _count: true,
    }),
    prisma.deal.groupBy({
      by: ["stageId"],
      where: { businessId, status: "OPEN" },
      _count: true,
      _sum: { value: true },
    }),
    prisma.deal.groupBy({
      by: ["ownerId"],
      where: { businessId, status: "WON", wonAt: { gte: since } },
      _count: true,
      _sum: { value: true },
    }),
  ]);

  const agents = await prisma.aiAgent.findMany({ where: { businessId } });
  const agentName = new Map(agents.map((a) => [a.id, a.name]));
  const failedRuns = await prisma.agentRun.groupBy({
    by: ["agentId"],
    where: { businessId, createdAt: { gte: since }, status: "FAILED" },
    _count: true,
  });
  const failMap = new Map(failedRuns.map((r) => [r.agentId, r._count]));

  return {
    metrics,
    leadSources: leadSources.map((s) => ({ source: s.source, count: s._count })),
    agentPerformance: agentPerf.map((a) => ({
      name: agentName.get(a.agentId) ?? "Agent",
      runs: a._count,
      tokens: a._sum.tokensUsed ?? 0,
      avgMs: Math.round(a._avg.durationMs ?? 0),
      failures: failMap.get(a.agentId) ?? 0,
    })),
    callOutcomes: callStats.map((c) => ({ outcome: c.outcome ?? "UNKNOWN", count: c._count })),
    dealsByStage,
    teamPerformance: teamPerf,
  };
}

// --- Notifications ----------------------------------------------------------

export async function getUnreadNotifications(businessId: string) {
  const [items, count] = await Promise.all([
    prisma.notification.findMany({
      where: { businessId },
      orderBy: { createdAt: "desc" },
      take: 12,
    }),
    prisma.notification.count({ where: { businessId, readAt: null } }),
  ]);
  return { items, count };
}
