"use client";

import { useState } from "react";
import {
  PhoneIncoming,
  PhoneOutgoing,
  PhoneMissed,
  Sparkles,
  FileText,
  ChevronDown,
  ArrowRightLeft,
} from "lucide-react";
import { Avatar, Badge } from "@/components/ui/primitives";
import { CallOutcomeBadge } from "@/components/ui/badges";
import { cn, formatDuration, timeAgo } from "@/lib/utils";

interface CallVM {
  id: string;
  direction: string;
  status: string;
  contactName: string;
  contactPhone: string | null;
  durationSec: number;
  outcome: string | null;
  sentiment: string | null;
  aiSummary: string | null;
  transcript: string | null;
  agentName: string | null;
  transferredTo: string | null;
  startedAt: string;
}

export function CallList({ calls }: { calls: CallVM[] }) {
  const [openId, setOpenId] = useState<string | null>(null);

  return (
    <div className="divide-y divide-border">
      {calls.map((call) => {
        const Icon =
          call.status === "MISSED"
            ? PhoneMissed
            : call.direction === "INBOUND"
              ? PhoneIncoming
              : PhoneOutgoing;
        const iconTone =
          call.status === "MISSED"
            ? "bg-danger-soft text-danger"
            : call.direction === "INBOUND"
              ? "bg-primary-softer text-primary"
              : "bg-purple-soft text-purple";
        const open = openId === call.id;
        return (
          <div key={call.id}>
            <button
              onClick={() => setOpenId(open ? null : call.id)}
              className="flex w-full items-center gap-3 px-5 py-3 text-left transition-colors hover:bg-surface-muted"
            >
              <div className={cn("flex h-9 w-9 items-center justify-center rounded-lg", iconTone)}>
                <Icon size={16} />
              </div>
              <Avatar name={call.contactName} size={32} tone="neutral" />
              <div className="min-w-0 flex-1">
                <p className="text-[13px] font-semibold text-text">{call.contactName}</p>
                <p className="text-xs text-text-muted">{call.contactPhone ?? call.direction}</p>
              </div>
              <div className="hidden items-center gap-2 sm:flex">
                <CallOutcomeBadge outcome={call.outcome} />
                {call.sentiment && (
                  <Badge tone={call.sentiment === "POSITIVE" ? "success" : call.sentiment === "NEGATIVE" ? "danger" : "neutral"}>
                    {call.sentiment}
                  </Badge>
                )}
              </div>
              <span className="w-14 text-right text-xs font-medium text-text-secondary">
                {call.durationSec > 0 ? formatDuration(call.durationSec) : "—"}
              </span>
              <span className="hidden w-16 text-right text-[11px] text-text-muted md:block">
                {timeAgo(call.startedAt)}
              </span>
              <ChevronDown size={16} className={cn("text-text-muted transition-transform", open && "rotate-180")} />
            </button>

            {open && (
              <div className="space-y-3 bg-surface-muted/50 px-5 py-4">
                {call.agentName && (
                  <p className="flex items-center gap-1.5 text-xs text-text-secondary">
                    <Sparkles size={12} className="text-primary" /> Handled by {call.agentName}
                    {call.transferredTo && (
                      <span className="flex items-center gap-1 text-warning">
                        <ArrowRightLeft size={12} /> Transferred to {call.transferredTo}
                      </span>
                    )}
                  </p>
                )}
                {call.aiSummary && (
                  <div className="rounded-lg border border-border bg-surface p-3">
                    <p className="mb-1 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-text-muted">
                      <Sparkles size={11} className="text-primary" /> AI Summary
                    </p>
                    <p className="text-xs leading-relaxed text-text-secondary">{call.aiSummary}</p>
                  </div>
                )}
                {call.transcript && (
                  <div className="rounded-lg border border-border bg-surface p-3">
                    <p className="mb-1.5 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-text-muted">
                      <FileText size={11} /> Transcript
                    </p>
                    <pre className="whitespace-pre-wrap font-sans text-xs leading-relaxed text-text-secondary">
                      {call.transcript}
                    </pre>
                  </div>
                )}
                {!call.aiSummary && !call.transcript && (
                  <p className="text-xs text-text-muted">No transcript available for this call.</p>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
