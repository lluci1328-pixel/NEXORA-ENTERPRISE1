"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { MoreVertical, Trophy, X, Sparkles, GripVertical } from "lucide-react";
import { Avatar } from "@/components/ui/primitives";
import { cn, formatCompactCurrency } from "@/lib/utils";
import { moveDealStageAction, markDealOutcomeAction } from "@/lib/actions";

interface Deal {
  id: string;
  title: string;
  value: number;
  contactName: string;
  ownerName: string | null;
  aiSummary: string | null;
}
interface Stage {
  id: string;
  name: string;
  color: string;
  probability: number;
  deals: Deal[];
}

export function DealsBoard({
  slug,
  currency,
  stages,
}: {
  slug: string;
  currency: string;
  stages: Stage[];
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [dragId, setDragId] = useState<string | null>(null);
  const [menuId, setMenuId] = useState<string | null>(null);

  const move = (dealId: string, stageId: string) =>
    startTransition(async () => {
      await moveDealStageAction(slug, dealId, stageId);
      router.refresh();
    });

  const outcome = (dealId: string, result: "WON" | "LOST") =>
    startTransition(async () => {
      await markDealOutcomeAction(slug, dealId, result, result === "LOST" ? "Closed from board" : undefined);
      setMenuId(null);
      router.refresh();
    });

  return (
    <div className="flex gap-4 overflow-x-auto pb-4 scrollbar-slim">
      {stages.map((stage) => {
        const total = stage.deals.reduce((s, d) => s + d.value, 0);
        return (
          <div
            key={stage.id}
            onDragOver={(e) => e.preventDefault()}
            onDrop={() => {
              if (dragId) move(dragId, stage.id);
              setDragId(null);
            }}
            className="flex w-72 shrink-0 flex-col"
          >
            <div className="mb-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-full" style={{ background: stage.color }} />
                <p className="text-sm font-semibold text-text">{stage.name}</p>
                <span className="rounded-full bg-surface-inset px-2 py-0.5 text-[11px] font-semibold text-text-muted">
                  {stage.deals.length}
                </span>
              </div>
              <span className="text-[11px] font-medium text-text-muted">{stage.probability}%</span>
            </div>
            <p className="mb-2 text-xs font-semibold text-text-secondary">
              {formatCompactCurrency(total, currency)}
            </p>

            <div className="flex min-h-24 flex-1 flex-col gap-2 rounded-xl bg-canvas-2/60 p-2">
              {stage.deals.map((deal) => (
                <div
                  key={deal.id}
                  draggable
                  onDragStart={() => setDragId(deal.id)}
                  onDragEnd={() => setDragId(null)}
                  className={cn(
                    "group relative cursor-grab rounded-lg border border-border bg-surface p-3 shadow-sm transition-all hover:shadow-md active:cursor-grabbing",
                    dragId === deal.id && "opacity-50",
                  )}
                >
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-[13px] font-semibold leading-snug text-text">{deal.title}</p>
                    <button
                      onClick={() => setMenuId(menuId === deal.id ? null : deal.id)}
                      className="shrink-0 rounded p-0.5 text-text-muted opacity-0 hover:bg-surface-muted group-hover:opacity-100"
                    >
                      <MoreVertical size={15} />
                    </button>
                  </div>
                  <p className="mt-1.5 text-sm font-bold text-primary">
                    {formatCompactCurrency(deal.value, currency)}
                  </p>
                  {deal.aiSummary && (
                    <p className="mt-1.5 flex items-start gap-1 text-[11px] leading-snug text-text-muted">
                      <Sparkles size={11} className="mt-0.5 shrink-0 text-primary" />
                      <span className="line-clamp-2">{deal.aiSummary}</span>
                    </p>
                  )}
                  <div className="mt-2.5 flex items-center justify-between border-t border-border pt-2">
                    <span className="flex items-center gap-1.5 text-[11px] text-text-secondary">
                      <Avatar name={deal.contactName} size={20} tone="neutral" />
                      {deal.contactName.split(" ")[0]}
                    </span>
                    <GripVertical size={13} className="text-text-muted" />
                  </div>

                  {menuId === deal.id && (
                    <div className="absolute right-2 top-8 z-20 w-40 rounded-lg border border-border bg-surface p-1 shadow-lg">
                      <button
                        onClick={() => outcome(deal.id, "WON")}
                        className="flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-xs font-medium text-success hover:bg-success-soft"
                      >
                        <Trophy size={13} /> Mark as Won
                      </button>
                      <button
                        onClick={() => outcome(deal.id, "LOST")}
                        className="flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-xs font-medium text-danger hover:bg-danger-soft"
                      >
                        <X size={13} /> Mark as Lost
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
