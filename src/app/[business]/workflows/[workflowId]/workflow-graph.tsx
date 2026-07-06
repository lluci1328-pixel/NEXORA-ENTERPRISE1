import { ArrowDown } from "lucide-react";

interface GraphNode {
  id: string;
  label: string;
  order: number;
}

/**
 * Read-only visual renderer for a workflow's node graph — the same structure
 * n8n executes. Rendered as a clean vertical pipeline with connectors so a
 * business owner can see exactly what the automation does end to end.
 */
export function WorkflowGraph({ nodes }: { nodes: GraphNode[] }) {
  const ordered = [...nodes].sort((a, b) => a.order - b.order);

  const toneFor = (label: string): string => {
    const l = label.toLowerCase();
    if (l.includes("trigger") || l.includes("webhook") || l.includes("cron") || l.includes("schedule"))
      return "border-purple/30 bg-purple-soft text-purple";
    if (l.includes("ai") || l.includes("agent") || l.includes("orchestrat") || l.includes("qualif") || l.includes("compose") || l.includes("briefing"))
      return "border-primary/30 bg-primary-soft text-primary-hover";
    if (l.includes("crm") || l.includes("update") || l.includes("log") || l.includes("book") || l.includes("assign"))
      return "border-success/30 bg-success-soft text-success";
    if (l.includes("send") || l.includes("notify") || l.includes("alert") || l.includes("reply") || l.includes("whatsapp") || l.includes("email"))
      return "border-warning/30 bg-warning-soft text-warning";
    return "border-border bg-surface text-text-secondary";
  };

  return (
    <div className="mx-auto flex max-w-md flex-col items-center">
      {ordered.map((node, i) => (
        <div key={node.id} className="flex w-full flex-col items-center">
          <div
            className={`w-full rounded-xl border px-4 py-3 text-center text-sm font-semibold shadow-sm ${toneFor(node.label)}`}
          >
            <span className="mr-2 inline-flex h-5 w-5 items-center justify-center rounded-full bg-white/60 text-[11px] font-bold">
              {i + 1}
            </span>
            {node.label}
          </div>
          {i < ordered.length - 1 && (
            <div className="flex h-8 items-center justify-center">
              <ArrowDown size={18} className="text-border-strong" />
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
