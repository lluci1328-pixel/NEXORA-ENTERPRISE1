import { resolvePageContext } from "@/lib/page-context";
import { prisma } from "@/lib/db";
import { PageHeading } from "@/components/ui/primitives";
import { DealsBoard } from "./deals-board";
import { formatCompactCurrency } from "@/lib/utils";

export default async function DealsPage({ params }: { params: Promise<{ business: string }> }) {
  const { business } = await resolvePageContext((await params).business);

  const pipeline = await prisma.pipeline.findFirst({
    where: { businessId: business.id, isDefault: true },
    include: {
      stages: { orderBy: { order: "asc" } },
      deals: {
        where: { status: "OPEN" },
        include: { contact: true, owner: true },
        orderBy: { updatedAt: "desc" },
      },
    },
  });

  const [wonAgg, openAgg] = await Promise.all([
    prisma.deal.aggregate({ where: { businessId: business.id, status: "WON" }, _sum: { value: true }, _count: true }),
    prisma.deal.aggregate({ where: { businessId: business.id, status: "OPEN" }, _sum: { value: true }, _count: true }),
  ]);

  if (!pipeline) {
    return <p className="text-sm text-text-muted">No pipeline configured.</p>;
  }

  const stages = pipeline.stages.map((s) => ({
    id: s.id,
    name: s.name,
    color: s.color,
    probability: s.probability,
    deals: pipeline.deals
      .filter((d) => d.stageId === s.id)
      .map((d) => ({
        id: d.id,
        title: d.title,
        value: d.value,
        contactName: `${d.contact.firstName} ${d.contact.lastName ?? ""}`.trim(),
        ownerName: d.owner?.name ?? null,
        aiSummary: d.aiSummary,
      })),
  }));

  return (
    <div className="space-y-6">
      <PageHeading title="Deals" description="Drag deals through your pipeline · move, win or lose in one click">
        <div className="flex gap-2">
          <div className="rounded-lg border border-border bg-surface px-4 py-2 text-right">
            <p className="text-[11px] text-text-muted">Open Pipeline</p>
            <p className="text-sm font-bold text-text">{formatCompactCurrency(openAgg._sum.value ?? 0, business.currency)}</p>
          </div>
          <div className="rounded-lg border border-border bg-success-soft px-4 py-2 text-right">
            <p className="text-[11px] text-success">Won ({wonAgg._count})</p>
            <p className="text-sm font-bold text-success">{formatCompactCurrency(wonAgg._sum.value ?? 0, business.currency)}</p>
          </div>
        </div>
      </PageHeading>

      <DealsBoard slug={business.slug} currency={business.currency} stages={stages} />
    </div>
  );
}
