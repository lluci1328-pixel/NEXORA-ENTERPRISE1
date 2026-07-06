import Link from "next/link";
import { notFound } from "next/navigation";
import { resolvePageContext } from "@/lib/page-context";
import { prisma } from "@/lib/db";
import { Card, CardHeader, Badge } from "@/components/ui/primitives";
import { WorkflowGraph } from "./workflow-graph";
import { parseJson, formatNumber, timeAgo, formatDuration, titleCase } from "@/lib/utils";
import { ArrowLeft, CheckCircle2, XCircle, Clock, Zap } from "lucide-react";

interface GraphNode {
  id: string;
  label: string;
  order: number;
}

export default async function WorkflowDetailPage({
  params,
}: {
  params: Promise<{ business: string; workflowId: string }>;
}) {
  const { business: slug, workflowId } = await params;
  const { business } = await resolvePageContext(slug);

  const workflow = await prisma.workflow.findFirst({
    where: { id: workflowId, businessId: business.id },
  });
  if (!workflow) notFound();

  const [runs, stats] = await Promise.all([
    prisma.workflowRun.findMany({
      where: { businessId: business.id, workflowId: workflow.id },
      orderBy: { startedAt: "desc" },
      take: 15,
    }),
    prisma.workflowRun.groupBy({
      by: ["status"],
      where: { businessId: business.id, workflowId: workflow.id },
      _count: true,
      _avg: { durationMs: true },
    }),
  ]);

  const def = parseJson<{ nodes: GraphNode[]; edges: [string, string][] }>(workflow.definitionJson, {
    nodes: [],
    edges: [],
  });
  const success = stats.find((s) => s.status === "SUCCESS")?._count ?? 0;
  const failed = stats.find((s) => s.status === "FAILED")?._count ?? 0;
  const total = success + failed;
  const avgMs = Math.round(stats.reduce((s, x) => s + (x._avg.durationMs ?? 0), 0) / (stats.length || 1));

  return (
    <div className="space-y-6">
      <Link href={`/${slug}/workflows`} className="inline-flex items-center gap-1.5 text-sm font-medium text-text-secondary hover:text-text">
        <ArrowLeft size={16} /> Back to workflows
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight text-text">{workflow.name}</h1>
            <Badge tone={workflow.status === "ACTIVE" ? "success" : workflow.status === "PAUSED" ? "warning" : "neutral"} dot={workflow.status === "ACTIVE"}>
              {titleCase(workflow.status)}
            </Badge>
          </div>
          <p className="mt-1 max-w-2xl text-sm text-text-secondary">{workflow.description}</p>
        </div>
        {workflow.n8nWorkflowId && (
          <div className="rounded-lg border border-border bg-surface px-4 py-2 text-right">
            <p className="text-[11px] text-text-muted">n8n Workflow ID</p>
            <p className="font-mono text-xs font-semibold text-text">{workflow.n8nWorkflowId}</p>
          </div>
        )}
      </div>

      {/* Run stats */}
      <div className="grid gap-4 sm:grid-cols-4">
        <Card className="flex items-center gap-3 p-4">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-success-soft text-success"><CheckCircle2 size={16} /></div>
          <div><p className="text-lg font-bold text-text stat-value">{formatNumber(success)}</p><p className="text-xs text-text-muted">Successful</p></div>
        </Card>
        <Card className="flex items-center gap-3 p-4">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-danger-soft text-danger"><XCircle size={16} /></div>
          <div><p className="text-lg font-bold text-text stat-value">{formatNumber(failed)}</p><p className="text-xs text-text-muted">Failed</p></div>
        </Card>
        <Card className="flex items-center gap-3 p-4">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary-softer text-primary"><Zap size={16} /></div>
          <div><p className="text-lg font-bold text-text stat-value">{total > 0 ? Math.round((success / total) * 100) : 100}%</p><p className="text-xs text-text-muted">Success rate</p></div>
        </Card>
        <Card className="flex items-center gap-3 p-4">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-purple-soft text-purple"><Clock size={16} /></div>
          <div><p className="text-lg font-bold text-text stat-value">{formatDuration(Math.round(avgMs / 1000))}</p><p className="text-xs text-text-muted">Avg duration</p></div>
        </Card>
      </div>

      {/* Visual graph */}
      <Card>
        <CardHeader title="Workflow Pipeline" subtitle={`Trigger: ${workflow.trigger}`} icon={<Zap size={16} />} />
        <div className="p-5 pt-3">
          <WorkflowGraph nodes={def.nodes} />
        </div>
      </Card>

      {/* Recent runs */}
      <Card>
        <CardHeader title="Recent Executions" icon={<Clock size={16} />} />
        <div className="divide-y divide-border">
          {runs.map((run) => (
            <div key={run.id} className="flex items-center gap-3 px-5 py-3">
              {run.status === "SUCCESS" ? (
                <CheckCircle2 size={16} className="text-success" />
              ) : run.status === "FAILED" ? (
                <XCircle size={16} className="text-danger" />
              ) : (
                <Clock size={16} className="text-warning" />
              )}
              <div className="min-w-0 flex-1">
                <p className="text-[13px] font-medium text-text">
                  {run.triggerSource ?? "manual"} · {run.stepsCompleted}/{run.totalSteps} steps
                </p>
                {run.error && <p className="truncate text-xs text-danger">{run.error}</p>}
              </div>
              <span className="text-xs text-text-muted">{formatDuration(Math.round(run.durationMs / 1000))}</span>
              <span className="w-16 text-right text-[11px] text-text-muted">{timeAgo(run.startedAt)}</span>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
