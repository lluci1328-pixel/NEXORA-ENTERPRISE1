import Link from "next/link";
import { resolvePageContext } from "@/lib/page-context";
import { prisma } from "@/lib/db";
import { PageHeading, Badge } from "@/components/ui/primitives";
import { formatNumber, timeAgo, titleCase } from "@/lib/utils";
import {
  Workflow as WorkflowIcon,
  MessageSquare,
  Phone,
  Repeat,
  Route,
  BarChart3,
  Bell,
  ArrowRight,
  CheckCircle2,
  XCircle,
  type LucideIcon,
} from "lucide-react";

const CATEGORY_ICON: Record<string, LucideIcon> = {
  MESSAGING: MessageSquare,
  VOICE: Phone,
  FOLLOW_UP: Repeat,
  LEAD_ROUTING: Route,
  ANALYTICS: BarChart3,
  NOTIFICATIONS: Bell,
};

export default async function WorkflowsPage({ params }: { params: Promise<{ business: string }> }) {
  const { business } = await resolvePageContext((await params).business);

  const workflows = await prisma.workflow.findMany({
    where: { businessId: business.id },
    orderBy: { createdAt: "asc" },
  });

  const runStats = await prisma.workflowRun.groupBy({
    by: ["workflowId", "status"],
    where: { businessId: business.id },
    _count: true,
  });
  const statsMap = new Map<string, { success: number; failed: number; total: number }>();
  for (const r of runStats) {
    const cur = statsMap.get(r.workflowId) ?? { success: 0, failed: 0, total: 0 };
    if (r.status === "SUCCESS") cur.success += r._count;
    if (r.status === "FAILED") cur.failed += r._count;
    cur.total += r._count;
    statsMap.set(r.workflowId, cur);
  }

  const lastRuns = await prisma.workflowRun.findMany({
    where: { businessId: business.id },
    orderBy: { startedAt: "desc" },
    distinct: ["workflowId"],
    select: { workflowId: true, startedAt: true, status: true },
  });
  const lastRunMap = new Map(lastRuns.map((r) => [r.workflowId, r]));

  const activeCount = workflows.filter((w) => w.status === "ACTIVE").length;

  return (
    <div className="space-y-6">
      <PageHeading
        title="Workflows"
        description="Production automations connecting channels, AI agents, CRM and analytics"
      >
        <Badge tone="success" dot>
          {activeCount} active
        </Badge>
      </PageHeading>

      <div className="grid gap-4 md:grid-cols-2">
        {workflows.map((wf) => {
          const Icon = CATEGORY_ICON[wf.category] ?? WorkflowIcon;
          const stats = statsMap.get(wf.id) ?? { success: 0, failed: 0, total: 0 };
          const last = lastRunMap.get(wf.id);
          const successRate = stats.total > 0 ? Math.round((stats.success / stats.total) * 100) : 100;
          return (
            <Link key={wf.id} href={`/${business.slug}/workflows/${wf.id}`} className="card card-hover group p-5">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary-softer text-primary">
                    <Icon size={20} />
                  </div>
                  <div>
                    <h3 className="text-[15px] font-semibold text-text group-hover:text-primary">{wf.name}</h3>
                    <p className="text-xs text-text-muted">{titleCase(wf.category)}</p>
                  </div>
                </div>
                <Badge tone={wf.status === "ACTIVE" ? "success" : wf.status === "PAUSED" ? "warning" : "neutral"} dot={wf.status === "ACTIVE"}>
                  {titleCase(wf.status)}
                </Badge>
              </div>

              <p className="mt-3 line-clamp-2 text-xs leading-relaxed text-text-secondary">{wf.description}</p>

              <div className="mt-3 flex items-center gap-1.5 rounded-lg bg-surface-inset px-3 py-2 text-xs text-text-secondary">
                <span className="font-semibold text-text-muted">Trigger:</span> {wf.trigger}
              </div>

              <div className="mt-4 flex items-center justify-between border-t border-border pt-3 text-xs">
                <div className="flex items-center gap-4">
                  <span className="flex items-center gap-1 text-success">
                    <CheckCircle2 size={13} /> {formatNumber(stats.success)}
                  </span>
                  <span className="flex items-center gap-1 text-danger">
                    <XCircle size={13} /> {formatNumber(stats.failed)}
                  </span>
                  <span className="font-semibold text-text">{successRate}% success</span>
                </div>
                <span className="flex items-center gap-1 font-medium text-primary group-hover:gap-1.5">
                  View <ArrowRight size={13} />
                </span>
              </div>
              {last && (
                <p className="mt-2 text-[11px] text-text-muted">Last run {timeAgo(last.startedAt)}</p>
              )}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
