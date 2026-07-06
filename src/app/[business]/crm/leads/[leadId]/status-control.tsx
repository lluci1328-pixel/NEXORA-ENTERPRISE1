"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { LEAD_STATUSES } from "@/lib/constants";
import { titleCase } from "@/lib/utils";
import { updateLeadStatusAction } from "@/lib/actions";

export function LeadStatusControl({
  slug,
  leadId,
  currentStatus,
}: {
  slug: string;
  leadId: string;
  currentStatus: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <select
      value={currentStatus}
      disabled={pending}
      onChange={(e) => {
        const status = e.target.value;
        startTransition(async () => {
          await updateLeadStatusAction(slug, leadId, status);
          router.refresh();
        });
      }}
      className="input w-auto py-1.5 text-xs font-semibold disabled:opacity-60"
    >
      {LEAD_STATUSES.map((s) => (
        <option key={s} value={s}>
          {titleCase(s)}
        </option>
      ))}
    </select>
  );
}
