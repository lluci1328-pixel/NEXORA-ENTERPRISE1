import { resolvePageContext } from "@/lib/page-context";
import { prisma } from "@/lib/db";
import { PageHeading, Card, Avatar, Badge } from "@/components/ui/primitives";
import { titleCase, timeAgo } from "@/lib/utils";
import { Phone, Mail } from "lucide-react";

export default async function ContactsPage({ params }: { params: Promise<{ business: string }> }) {
  const { business } = await resolvePageContext((await params).business);

  const contacts = await prisma.contact.findMany({
    where: { businessId: business.id },
    include: { owner: true, company: true, _count: { select: { deals: true, conversations: true } } },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  const stageTone: Record<string, "primary" | "success" | "purple" | "neutral"> = {
    LEAD: "primary",
    PROSPECT: "purple",
    CUSTOMER: "success",
    CHURNED: "neutral",
  };

  return (
    <div className="space-y-6">
      <PageHeading title="Contacts" description={`${contacts.length} people in your CRM`} />

      <Card className="overflow-hidden">
        <div className="overflow-x-auto scrollbar-slim">
          <table className="w-full min-w-[820px] text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs font-semibold uppercase tracking-wide text-text-muted">
                <th className="px-5 py-3">Contact</th>
                <th className="px-5 py-3">Company</th>
                <th className="px-5 py-3">Stage</th>
                <th className="px-5 py-3">Source</th>
                <th className="px-5 py-3">Deals</th>
                <th className="px-5 py-3">Owner</th>
                <th className="px-5 py-3">Added</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {contacts.map((c) => (
                <tr key={c.id} className="transition-colors hover:bg-surface-muted">
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-3">
                      <Avatar name={`${c.firstName} ${c.lastName ?? ""}`} size={34} />
                      <div>
                        <p className="text-[13px] font-semibold text-text">
                          {c.firstName} {c.lastName ?? ""}
                        </p>
                        <div className="flex items-center gap-3 text-[11px] text-text-muted">
                          {c.phone && <span className="flex items-center gap-1"><Phone size={10} /> {c.phone}</span>}
                          {c.email && <span className="flex items-center gap-1"><Mail size={10} /> {c.email}</span>}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="px-5 py-3 text-[13px] text-text-secondary">{c.company?.name ?? "—"}</td>
                  <td className="px-5 py-3">
                    <Badge tone={stageTone[c.lifecycleStage] ?? "neutral"}>{titleCase(c.lifecycleStage)}</Badge>
                  </td>
                  <td className="px-5 py-3 text-xs text-text-secondary">{c.source ? titleCase(c.source) : "—"}</td>
                  <td className="px-5 py-3 text-[13px] text-text">{c._count.deals}</td>
                  <td className="px-5 py-3 text-xs text-text-secondary">{c.owner?.name.split(" ")[0] ?? "—"}</td>
                  <td className="px-5 py-3 text-xs text-text-muted">{timeAgo(c.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
