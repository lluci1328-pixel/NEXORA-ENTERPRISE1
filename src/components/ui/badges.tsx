import { Badge } from "./primitives";
import { titleCase } from "@/lib/utils";

/** Maps domain status strings to consistent badge tones across the app. */

export function LeadStatusBadge({ status }: { status: string }) {
  const tone =
    status === "QUALIFIED" ? "primary"
    : status === "CONVERTED" ? "success"
    : status === "CONTACTED" ? "purple"
    : status === "LOST" || status === "UNQUALIFIED" ? "danger"
    : "neutral";
  return <Badge tone={tone}>{titleCase(status)}</Badge>;
}

export function DealStatusBadge({ status }: { status: string }) {
  const tone = status === "WON" ? "success" : status === "LOST" ? "danger" : "primary";
  return <Badge tone={tone}>{titleCase(status)}</Badge>;
}

export function ConversationStatusBadge({ status }: { status: string }) {
  const map: Record<string, { tone: "primary" | "warning" | "success" | "neutral"; label: string }> = {
    AI_HANDLING: { tone: "primary", label: "AI Handling" },
    HUMAN_TAKEOVER: { tone: "warning", label: "Human" },
    RESOLVED: { tone: "success", label: "Resolved" },
    OPEN: { tone: "neutral", label: "Open" },
  };
  const cfg = map[status] ?? { tone: "neutral" as const, label: titleCase(status) };
  return <Badge tone={cfg.tone} dot={status === "AI_HANDLING"}>{cfg.label}</Badge>;
}

export function AgentStatusBadge({ status }: { status: string }) {
  const map: Record<string, { tone: "success" | "warning" | "danger" | "neutral"; label: string }> = {
    ACTIVE: { tone: "success", label: "Active" },
    PAUSED: { tone: "warning", label: "Paused" },
    AWAITING_API_KEY: { tone: "neutral", label: "Awaiting API Key" },
    ERROR: { tone: "danger", label: "Error" },
  };
  const cfg = map[status] ?? { tone: "neutral" as const, label: titleCase(status) };
  return <Badge tone={cfg.tone} dot={status === "ACTIVE"}>{cfg.label}</Badge>;
}

export function CallOutcomeBadge({ outcome }: { outcome: string | null }) {
  if (!outcome) return <Badge tone="neutral">—</Badge>;
  const tone =
    outcome === "APPOINTMENT_BOOKED" || outcome === "QUALIFIED" ? "success"
    : outcome === "NOT_INTERESTED" || outcome === "NO_ANSWER" ? "danger"
    : outcome === "TRANSFERRED_TO_HUMAN" ? "warning"
    : "primary";
  return <Badge tone={tone}>{titleCase(outcome)}</Badge>;
}

export function PriorityBadge({ priority }: { priority: string }) {
  const tone =
    priority === "URGENT" || priority === "CRITICAL" ? "danger"
    : priority === "HIGH" ? "warning"
    : priority === "LOW" ? "neutral"
    : "primary";
  return <Badge tone={tone}>{titleCase(priority)}</Badge>;
}

export function ScorePill({ score }: { score: number }) {
  const tone = score >= 85 ? "success" : score >= 60 ? "primary" : score >= 40 ? "warning" : "neutral";
  return <Badge tone={tone}>{score}/100</Badge>;
}

export function StatusDot({ connected }: { connected: boolean }) {
  return (
    <span
      className="inline-block h-2 w-2 rounded-full"
      style={{ background: connected ? "var(--success)" : "var(--text-muted)" }}
    />
  );
}
