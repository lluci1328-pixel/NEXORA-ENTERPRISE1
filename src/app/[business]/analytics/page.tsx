import { resolvePageContext } from "@/lib/page-context";
import { getAnalytics } from "@/lib/queries";
import { prisma } from "@/lib/db";
import { PageHeading, Card, CardHeader, ProgressBar } from "@/components/ui/primitives";
import { RevenueAreaChart, LeadsLineChart, DonutChart, SimpleBarChart } from "@/components/ui/charts";
import { formatNumber, formatCompactCurrency, titleCase } from "@/lib/utils";
import { IndianRupee, Users, Target, Phone, Gauge } from "lucide-react";

export default async function AnalyticsPage({ params }: { params: Promise<{ business: string }> }) {
  const { business } = await resolvePageContext((await params).business);
  const data = await getAnalytics(business.id, 30);

  // Build daily series from metrics
  const byDate = new Map<string, { date: string; revenue: number; leads: number; qualified: number }>();
  for (const m of data.metrics) {
    const key = m.date.toISOString().slice(0, 10);
    const e = byDate.get(key) ?? { date: key, revenue: 0, leads: 0, qualified: 0 };
    if (m.metric === "REVENUE") e.revenue = m.value;
    if (m.metric === "NEW_LEADS") e.leads = m.value;
    if (m.metric === "LEADS_QUALIFIED") e.qualified = m.value;
    byDate.set(key, e);
  }
  const series = [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date));

  const sum = (metric: string) => data.metrics.filter((m) => m.metric === metric).reduce((s, m) => s + m.value, 0);
  const totalRevenue = sum("REVENUE");
  const totalLeads = sum("NEW_LEADS");
  const totalWon = sum("DEALS_WON");
  const conversionRate = totalLeads > 0 ? (totalWon / totalLeads) * 100 : 0;
  const csatValues = data.metrics.filter((m) => m.metric === "CSAT");
  const avgCsat = csatValues.length > 0 ? csatValues.reduce((s, m) => s + m.value, 0) / csatValues.length : 0;

  const owners = await prisma.user.findMany({
    where: { id: { in: data.teamPerformance.map((t) => t.ownerId).filter((x): x is string => !!x) } },
  });
  const ownerName = new Map(owners.map((o) => [o.id, o.name]));

  const headline = [
    { label: "Revenue (30d)", value: formatCompactCurrency(totalRevenue, business.currency), icon: IndianRupee, tone: "bg-success-soft text-success" },
    { label: "New Leads", value: formatNumber(Math.round(totalLeads)), icon: Users, tone: "bg-primary-softer text-primary" },
    { label: "Conversion Rate", value: `${conversionRate.toFixed(1)}%`, icon: Target, tone: "bg-purple-soft text-purple" },
    { label: "Avg CSAT", value: `${avgCsat.toFixed(1)}/5`, icon: Gauge, tone: "bg-warning-soft text-warning" },
  ];

  const maxAgentRuns = Math.max(1, ...data.agentPerformance.map((a) => a.runs));

  return (
    <div className="space-y-6">
      <PageHeading title="Analytics" description="Revenue, conversions, AI performance and team results · last 30 days" />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {headline.map((h) => (
          <Card key={h.label} className="p-5">
            <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${h.tone}`}>
              <h.icon size={18} />
            </div>
            <p className="mt-4 text-2xl font-bold text-text stat-value">{h.value}</p>
            <p className="mt-1 text-[13px] font-medium text-text-secondary">{h.label}</p>
          </Card>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader title="Revenue" subtitle="Daily closed-deal value" icon={<IndianRupee size={16} />} />
          <div className="px-3 pb-4 pt-2">
            <RevenueAreaChart data={series} currency={business.currency} />
          </div>
        </Card>
        <Card>
          <CardHeader title="Lead Sources" subtitle="Where your leads come from" />
          <div className="p-5 pt-2">
            <DonutChart data={data.leadSources.map((s) => ({ name: titleCase(s.source), value: s.count }))} />
          </div>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader title="New Leads Trend" icon={<Users size={16} />} />
          <div className="px-3 pb-4 pt-2">
            <LeadsLineChart data={series} />
          </div>
        </Card>
        <Card>
          <CardHeader title="Call Outcomes" subtitle="How voice conversations end" icon={<Phone size={16} />} />
          <div className="p-5 pt-2">
            {data.callOutcomes.length > 0 ? (
              <DonutChart data={data.callOutcomes.map((c) => ({ name: titleCase(c.outcome), value: c.count }))} />
            ) : (
              <p className="py-8 text-center text-sm text-text-muted">No call data yet.</p>
            )}
          </div>
        </Card>
      </div>

      {/* AI agent performance */}
      <Card>
        <CardHeader title="AI Agent Performance" subtitle="Actions run and reliability over the last 30 days" />
        <div className="space-y-3 p-5 pt-3">
          {data.agentPerformance
            .sort((a, b) => b.runs - a.runs)
            .map((a) => (
              <div key={a.name} className="flex items-center gap-4">
                <p className="w-44 shrink-0 truncate text-[13px] font-medium text-text">{a.name}</p>
                <div className="flex-1">
                  <ProgressBar value={(a.runs / maxAgentRuns) * 100} />
                </div>
                <span className="w-16 text-right text-xs font-semibold text-text">{formatNumber(a.runs)}</span>
                <span className="w-24 text-right text-[11px] text-text-muted">{formatNumber(a.tokens)} tok</span>
                <span className="w-20 text-right text-[11px]">
                  {a.failures > 0 ? (
                    <span className="text-danger">{a.failures} failed</span>
                  ) : (
                    <span className="text-success">100% ok</span>
                  )}
                </span>
              </div>
            ))}
        </div>
      </Card>

      {/* Team performance */}
      {data.teamPerformance.length > 0 && (
        <Card>
          <CardHeader title="Team Performance" subtitle="Revenue won per team member (30d)" />
          <div className="p-5 pt-3">
            <SimpleBarChart
              data={data.teamPerformance.map((t) => ({
                name: (ownerName.get(t.ownerId ?? "") ?? "Unassigned").split(" ")[0]!,
                revenue: t._sum.value ?? 0,
              }))}
              dataKey="revenue"
              labelKey="name"
              currency={business.currency}
            />
          </div>
        </Card>
      )}
    </div>
  );
}
