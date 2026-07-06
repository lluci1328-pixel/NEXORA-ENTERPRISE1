"use client";

import Link from "next/link";
import { cn } from "@/lib/utils";
import { LEAD_STATUSES } from "@/lib/constants";
import { titleCase } from "@/lib/utils";

export function LeadFilters({
  slug,
  activeFilter,
  activeStatus,
}: {
  slug: string;
  activeFilter?: string;
  activeStatus?: string;
}) {
  const base = `/${slug}/crm/leads`;
  const pill = (active: boolean) =>
    cn(
      "rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors",
      active
        ? "border-primary bg-primary-soft text-primary-hover"
        : "border-border bg-surface text-text-secondary hover:border-border-strong",
    );

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Link href={base} className={pill(!activeFilter && !activeStatus)}>
        All
      </Link>
      <Link href={`${base}?filter=hot`} className={pill(activeFilter === "hot")}>
        🔥 Hot (85+)
      </Link>
      <span className="mx-1 h-4 w-px bg-border" />
      {LEAD_STATUSES.map((s) => (
        <Link key={s} href={`${base}?status=${s}`} className={pill(activeStatus === s)}>
          {titleCase(s)}
        </Link>
      ))}
    </div>
  );
}
