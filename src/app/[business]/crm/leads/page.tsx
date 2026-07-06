import Link from "next/link";
import { resolvePageContext } from "@/lib/page-context";
import { prisma } from "@/lib/db";
import { PageHeading, Card, Avatar } from "@/components/ui/primitives";
import { LeadStatusBadge, ScorePill } from "@/components/ui/badges";
import { LeadFilters } from "./lead-filters";
import { formatCompactCurrency, timeAgo, titleCase } from "@/lib/utils";
import { Flame } from "lucide-react";

export default async function LeadsPage({
  params,
  searchParams,
}: {
  params: Promise<{ business: string }>;
  searchParams: Promise<{ filter?: string; status?: string }>;
}) {
  const { business } = await resolvePageContext((await params).business);
  const { filter, status } = await searchParams;

  const where = {
    businessId: business.id,
    ...(filter === "hot" ? { score: { gte: 85 } } : {}),
    ...(status ? { status } : {}),
  };

  const [leads, counts] = await Promise.all([
    prisma.lead.findMany({
      where,
      include: { contact: true, assignedTo: true },
      orderBy: [{ score: "desc" }, { createdAt: "desc" }],
      take: 100,
    }),
    prisma.lead.groupBy({ by: ["status"], where: { businessId: business.id }, _count: true }),
  ]);

  const total = counts.reduce((s, c) => s + c._count, 0);

  return (
    <div className="space-y-6">
      <PageHeading title="Leads" description={`${total} total leads · sorted by AI qualification score`} />

      <LeadFilters slug={business.slug} activeFilter={filter} activeStatus={status} />

      <Card className="overflow-hidden">
        <div className="overflow-x-auto scrollbar-slim">
          <table className="w-full min-w-[860px] text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs font-semibold uppercase tracking-wide text-text-muted">
                <th className="px-5 py-3">Lead</th>
                <th className="px-5 py-3">Requirement</th>
                <th className="px-5 py-3">Source</th>
                <th className="px-5 py-3">Budget</th>
                <th className="px-5 py-3">AI Score</th>
                <th className="px-5 py-3">Status</th>
                <th className="px-5 py-3">Owner</th>
                <th className="px-5 py-3">Age</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {leads.map((lead) => (
                <tr key={lead.id} className="group transition-colors hover:bg-surface-muted">
                  <td className="px-5 py-3">
                    <Link href={`/${business.slug}/crm/leads/${lead.id}`} className="flex items-center gap-3">
                      <Avatar name={`${lead.contact.firstName} ${lead.contact.lastName ?? ""}`} size={34} />
                      <div className="min-w-0">
                        <p className="flex items-center gap-1.5 text-[13px] font-semibold text-text group-hover:text-primary">
                          {lead.contact.firstName} {lead.contact.lastName ?? ""}
                          {lead.score >= 85 && <Flame size={13} className="text-danger" />}
                        </p>
                        <p className="text-xs text-text-muted">{lead.contact.phone}</p>
                      </div>
                    </Link>
                  </td>
                  <td className="max-w-[220px] px-5 py-3">
                    <p className="truncate text-[13px] text-text-secondary">{lead.requirement ?? lead.title}</p>
                  </td>
                  <td className="px-5 py-3 text-xs text-text-secondary">{titleCase(lead.source)}</td>
                  <td className="px-5 py-3 text-[13px] font-medium text-text">
                    {lead.budget ? formatCompactCurrency(lead.budget, business.currency) : "—"}
                  </td>
                  <td className="px-5 py-3"><ScorePill score={lead.score} /></td>
                  <td className="px-5 py-3"><LeadStatusBadge status={lead.status} /></td>
                  <td className="px-5 py-3">
                    {lead.assignedTo ? (
                      <span className="flex items-center gap-2 text-xs text-text-secondary">
                        <Avatar name={lead.assignedTo.name} size={24} tone="neutral" />
                        {lead.assignedTo.name.split(" ")[0]}
                      </span>
                    ) : (
                      <span className="text-xs text-text-muted">Unassigned</span>
                    )}
                  </td>
                  <td className="px-5 py-3 text-xs text-text-muted">{timeAgo(lead.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {leads.length === 0 && (
          <p className="px-5 py-12 text-center text-sm text-text-muted">No leads match this filter.</p>
        )}
      </Card>
    </div>
  );
}
