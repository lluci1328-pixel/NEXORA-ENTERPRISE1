"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import {
  Headset,
  Briefcase,
  LifeBuoy,
  Phone,
  Repeat,
  Target,
  CalendarClock,
  Database,
  BookOpen,
  BarChart3,
  type LucideIcon,
} from "lucide-react";
import { AgentStatusBadge } from "@/components/ui/badges";
import { formatNumber, cn } from "@/lib/utils";
import { toggleAgentStatusAction } from "@/lib/actions";

const AGENT_ICON: Record<string, LucideIcon> = {
  RECEPTION: Headset,
  SALES: Briefcase,
  SUPPORT: LifeBuoy,
  VOICE: Phone,
  FOLLOW_UP: Repeat,
  LEAD_QUALIFICATION: Target,
  APPOINTMENT: CalendarClock,
  CRM: Database,
  KNOWLEDGE: BookOpen,
  ANALYTICS: BarChart3,
};

interface AgentVM {
  id: string;
  type: string;
  name: string;
  description: string;
  model: string;
  status: string;
  runs: number;
  tokens: number;
}

export function AgentCard({
  slug,
  agent,
  aiReady,
}: {
  slug: string;
  agent: AgentVM;
  aiReady: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const Icon = AGENT_ICON[agent.type] ?? Headset;
  const isOn = agent.status === "ACTIVE";

  const toggle = () =>
    startTransition(async () => {
      await toggleAgentStatusAction(slug, agent.id);
      router.refresh();
    });

  return (
    <div className="card card-hover flex flex-col p-5">
      <div className="flex items-start justify-between">
        <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-accent text-white shadow-sm">
          <Icon size={20} />
        </div>
        <AgentStatusBadge status={agent.status} />
      </div>

      <h3 className="mt-3 text-[15px] font-semibold text-text">{agent.name}</h3>
      <p className="mt-1 flex-1 text-xs leading-relaxed text-text-secondary">{agent.description}</p>

      <div className="mt-4 grid grid-cols-2 gap-3 border-t border-border pt-3">
        <div>
          <p className="text-[11px] text-text-muted">Actions (30d)</p>
          <p className="text-sm font-bold text-text stat-value">{formatNumber(agent.runs)}</p>
        </div>
        <div>
          <p className="text-[11px] text-text-muted">Tokens used</p>
          <p className="text-sm font-bold text-text stat-value">{formatNumber(agent.tokens)}</p>
        </div>
      </div>

      <div className="mt-4 flex items-center justify-between">
        <span className="font-mono text-[11px] text-text-muted">{agent.model}</span>
        <button
          onClick={toggle}
          disabled={pending}
          className="flex items-center gap-2 text-xs font-semibold text-text-secondary disabled:opacity-50"
          title={isOn ? "Pause agent" : "Activate agent"}
        >
          <span
            className={cn(
              "relative h-5 w-9 rounded-full transition-colors",
              isOn ? "bg-success" : "bg-border-strong",
            )}
          >
            <span
              className={cn(
                "absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-all",
                isOn ? "left-[18px]" : "left-0.5",
              )}
            />
          </span>
          {isOn ? "Active" : "Paused"}
        </button>
      </div>

      {!aiReady && (
        <p className="mt-3 rounded-lg bg-surface-inset px-2.5 py-1.5 text-[11px] text-text-muted">
          Standby — add API key to activate live replies.
        </p>
      )}
    </div>
  );
}
