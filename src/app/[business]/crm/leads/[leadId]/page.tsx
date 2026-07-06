import Link from "next/link";
import { notFound } from "next/navigation";
import { resolvePageContext } from "@/lib/page-context";
import { prisma } from "@/lib/db";
import { Card, CardHeader, Avatar, Badge, ProgressBar } from "@/components/ui/primitives";
import { LeadStatusBadge, ScorePill } from "@/components/ui/badges";
import { LeadStatusControl } from "./status-control";
import { parseJson, formatCompactCurrency, timeAgo, titleCase } from "@/lib/utils";
import { ArrowLeft, Phone, Mail, MessageCircle, Sparkles, Target } from "lucide-react";

interface ScoreFactor {
  factor: string;
  points: number;
  detail: string;
}

export default async function LeadDetailPage({
  params,
}: {
  params: Promise<{ business: string; leadId: string }>;
}) {
  const { business: slug, leadId } = await params;
  const { business } = await resolvePageContext(slug);

  const lead = await prisma.lead.findFirst({
    where: { id: leadId, businessId: business.id },
    include: {
      contact: { include: { owner: true } },
      assignedTo: true,
      activities: { orderBy: { createdAt: "desc" }, include: { actor: true } },
    },
  });
  if (!lead) notFound();

  const factors = parseJson<ScoreFactor[]>(lead.scoreFactorsJson, []);
  const fullName = `${lead.contact.firstName} ${lead.contact.lastName ?? ""}`.trim();

  return (
    <div className="space-y-6">
      <Link href={`/${slug}/crm/leads`} className="inline-flex items-center gap-1.5 text-sm font-medium text-text-secondary hover:text-text">
        <ArrowLeft size={16} /> Back to leads
      </Link>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Left: profile + score */}
        <div className="space-y-6">
          <Card className="p-5">
            <div className="flex items-center gap-3">
              <Avatar name={fullName} size={52} tone="gradient" />
              <div>
                <h1 className="text-lg font-bold text-text">{fullName}</h1>
                <p className="text-xs text-text-muted">{titleCase(lead.source)} lead</p>
              </div>
            </div>
            <div className="mt-4 space-y-2 text-sm">
              {lead.contact.phone && (
                <p className="flex items-center gap-2 text-text-secondary">
                  <Phone size={14} className="text-text-muted" /> {lead.contact.phone}
                </p>
              )}
              {lead.contact.whatsapp && (
                <p className="flex items-center gap-2 text-text-secondary">
                  <MessageCircle size={14} className="text-text-muted" /> {lead.contact.whatsapp}
                </p>
              )}
              {lead.contact.email && (
                <p className="flex items-center gap-2 text-text-secondary">
                  <Mail size={14} className="text-text-muted" /> {lead.contact.email}
                </p>
              )}
            </div>
            <div className="mt-4 grid grid-cols-2 gap-3 border-t border-border pt-4">
              <div>
                <p className="text-[11px] text-text-muted">Budget</p>
                <p className="text-sm font-bold text-text">
                  {lead.budget ? formatCompactCurrency(lead.budget, business.currency) : "—"}
                </p>
              </div>
              <div>
                <p className="text-[11px] text-text-muted">Owner</p>
                <p className="text-sm font-semibold text-text">{lead.assignedTo?.name.split(" ")[0] ?? "—"}</p>
              </div>
            </div>
          </Card>

          {/* AI Score breakdown */}
          <Card>
            <CardHeader
              title="AI Qualification"
              subtitle={lead.qualifiedByAi ? "Scored by Lead Qualification Agent" : "Not yet scored"}
              icon={<Target size={16} />}
              action={<ScorePill score={lead.score} />}
            />
            <div className="space-y-3 p-5 pt-3">
              {factors.length > 0 ? (
                factors.map((f) => (
                  <div key={f.factor}>
                    <div className="mb-1 flex items-center justify-between text-xs">
                      <span className="font-medium text-text-secondary">{f.factor}</span>
                      <span className="font-semibold text-text">{f.points}</span>
                    </div>
                    <ProgressBar value={(f.points / 30) * 100} tone={f.points >= 20 ? "success" : "primary"} />
                    <p className="mt-1 text-[11px] text-text-muted">{f.detail}</p>
                  </div>
                ))
              ) : (
                <p className="text-xs text-text-muted">Score factors appear once the AI processes a conversation.</p>
              )}
            </div>
          </Card>
        </div>

        {/* Right: status control + timeline */}
        <div className="space-y-6 lg:col-span-2">
          <Card className="p-5">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-text-muted">Requirement</p>
                <p className="mt-1 text-sm font-medium text-text">{lead.requirement ?? lead.title}</p>
              </div>
              <div className="flex items-center gap-3">
                <LeadStatusBadge status={lead.status} />
                <LeadStatusControl slug={slug} leadId={lead.id} currentStatus={lead.status} />
              </div>
            </div>
          </Card>

          <Card>
            <CardHeader title="Activity Timeline" subtitle="Complete history for this lead" icon={<Sparkles size={16} />} />
            <div className="p-5 pt-3">
              <ol className="relative border-l border-border pl-6">
                {lead.activities.map((a) => (
                  <li key={a.id} className="mb-5 last:mb-0">
                    <span
                      className="absolute -left-[7px] mt-1 h-3.5 w-3.5 rounded-full border-2 border-surface"
                      style={{
                        background:
                          a.actorType === "AI_AGENT" ? "var(--primary)" : a.actorType === "USER" ? "var(--purple)" : "var(--text-muted)",
                      }}
                    />
                    <div className="flex items-center gap-2">
                      <p className="text-[13px] font-semibold text-text">{a.title}</p>
                      {a.actorType === "AI_AGENT" && <Badge tone="primary">AI</Badge>}
                    </div>
                    {a.description && <p className="mt-0.5 text-xs text-text-secondary">{a.description}</p>}
                    <p className="mt-0.5 text-[11px] text-text-muted">
                      {a.actor?.name ?? titleCase(a.actorType)} · {timeAgo(a.createdAt)}
                    </p>
                  </li>
                ))}
                {lead.activities.length === 0 && (
                  <li className="text-xs text-text-muted">No activity recorded yet.</li>
                )}
              </ol>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
