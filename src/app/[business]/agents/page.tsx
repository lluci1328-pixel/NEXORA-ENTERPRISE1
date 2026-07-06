import { resolvePageContext } from "@/lib/page-context";
import { prisma } from "@/lib/db";
import { isAiConfigured } from "@/lib/ai/provider";
import { PageHeading, Card } from "@/components/ui/primitives";
import { AgentCard } from "./agent-card";
import { formatNumber } from "@/lib/utils";
import { AGENT_TYPE_LABELS, type AgentType } from "@/lib/constants";
import { KeyRound, Bot, Zap, Network } from "lucide-react";

const startOfDay = (n: number) => {
  const d = new Date();
  d.setDate(d.getDate() - n);
  d.setUTCHours(0, 0, 0, 0);
  return d;
};

export default async function AgentsPage({ params }: { params: Promise<{ business: string }> }) {
  const { business } = await resolvePageContext((await params).business);
  const aiReady = isAiConfigured();

  const agents = await prisma.aiAgent.findMany({
    where: { businessId: business.id },
    orderBy: { type: "asc" },
  });

  const runs = await prisma.agentRun.groupBy({
    by: ["agentId"],
    where: { businessId: business.id, createdAt: { gte: startOfDay(30) } },
    _count: true,
    _sum: { tokensUsed: true },
  });
  const runMap = new Map(runs.map((r) => [r.agentId, { count: r._count, tokens: r._sum.tokensUsed ?? 0 }]));

  const totalRuns = runs.reduce((s, r) => s + r._count, 0);
  const activeCount = agents.filter((a) => a.status === "ACTIVE").length;

  return (
    <div className="space-y-6">
      <PageHeading
        title="AI Agents"
        description="A team of specialized agents working together across every channel"
      />

      {/* AI provider status banner */}
      {!aiReady && (
        <div className="flex items-start gap-3 rounded-xl border border-warning/30 bg-warning-soft px-5 py-4">
          <KeyRound size={18} className="mt-0.5 shrink-0 text-warning" />
          <div>
            <p className="text-sm font-semibold text-text">Connect your AI provider to go live</p>
            <p className="mt-0.5 text-xs text-text-secondary">
              Add your <span className="font-mono">ANTHROPIC_API_KEY</span> in the environment (or Settings →
              Integrations). Until then, agents are configured and ready but stay in standby — incoming messages
              are queued for a human instead of receiving AI replies. No fake responses are ever generated.
            </p>
          </div>
        </div>
      )}

      {/* Summary */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card className="flex items-center gap-3 p-5">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary-softer text-primary"><Bot size={18} /></div>
          <div>
            <p className="text-2xl font-bold text-text stat-value">{activeCount}/{agents.length}</p>
            <p className="text-[13px] text-text-secondary">Agents active</p>
          </div>
        </Card>
        <Card className="flex items-center gap-3 p-5">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-purple-soft text-purple"><Zap size={18} /></div>
          <div>
            <p className="text-2xl font-bold text-text stat-value">{formatNumber(totalRuns)}</p>
            <p className="text-[13px] text-text-secondary">Actions run (30d)</p>
          </div>
        </Card>
        <Card className="flex items-center gap-3 p-5">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-success-soft text-success"><Network size={18} /></div>
          <div>
            <p className="text-2xl font-bold text-text stat-value">Multi-agent</p>
            <p className="text-[13px] text-text-secondary">Agents share context</p>
          </div>
        </Card>
      </div>

      {/* Orchestration explainer */}
      <Card className="p-5">
        <p className="text-xs font-semibold uppercase tracking-wide text-text-muted">How they work together</p>
        <div className="mt-3 flex flex-wrap items-center gap-2 text-xs font-medium">
          {["Reception", "Knowledge", "Sales / Support", "CRM", "Lead Qualification", "Appointment", "Follow-up"].map(
            (step, i, arr) => (
              <span key={step} className="flex items-center gap-2">
                <span className="rounded-lg bg-primary-softer px-2.5 py-1.5 text-primary-hover">{step}</span>
                {i < arr.length - 1 && <span className="text-text-muted">→</span>}
              </span>
            ),
          )}
        </div>
        <p className="mt-3 text-xs text-text-secondary">
          Every inbound message flows through this pipeline. The Reception Agent routes intent, the Knowledge Agent
          grounds answers in your documents, a specialist replies, then the CRM and Lead Qualification agents update
          records and score the lead — all automatically.
        </p>
      </Card>

      {/* Agent grid */}
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {agents.map((agent) => {
          const stats = runMap.get(agent.id);
          return (
            <AgentCard
              key={agent.id}
              slug={business.slug}
              agent={{
                id: agent.id,
                type: agent.type,
                name: AGENT_TYPE_LABELS[agent.type as AgentType] ?? agent.name,
                description: agent.description,
                model: agent.model,
                status: aiReady ? agent.status : agent.status === "ACTIVE" ? "ACTIVE" : agent.status,
                runs: stats?.count ?? 0,
                tokens: stats?.tokens ?? 0,
              }}
              aiReady={aiReady}
            />
          );
        })}
      </div>
    </div>
  );
}
