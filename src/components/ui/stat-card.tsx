import type { ReactNode } from "react";
import { ArrowDownRight, ArrowUpRight } from "lucide-react";
import { cn } from "@/lib/utils";

export function StatCard({
  label,
  value,
  icon,
  change,
  hint,
  tone = "primary",
}: {
  label: string;
  value: ReactNode;
  icon: ReactNode;
  change?: number;
  hint?: string;
  tone?: "primary" | "success" | "warning" | "purple" | "accent";
}) {
  const toneBg: Record<string, string> = {
    primary: "bg-primary-softer text-primary",
    success: "bg-success-soft text-success",
    warning: "bg-warning-soft text-warning",
    purple: "bg-purple-soft text-purple",
    accent: "bg-[#e0f2fe] text-accent",
  };
  const hasChange = typeof change === "number";
  const positive = (change ?? 0) >= 0;
  return (
    <div className="card card-hover p-5">
      <div className="flex items-start justify-between">
        <div className={cn("flex h-10 w-10 items-center justify-center rounded-xl", toneBg[tone])}>
          {icon}
        </div>
        {hasChange && (
          <span
            className={cn(
              "flex items-center gap-0.5 text-xs font-semibold",
              positive ? "text-success" : "text-danger",
            )}
          >
            {positive ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}
            {Math.abs(change!).toFixed(1)}%
          </span>
        )}
      </div>
      <p className="mt-4 text-2xl font-bold text-text stat-value">{value}</p>
      <p className="mt-1 text-[13px] font-medium text-text-secondary">{label}</p>
      {hint && <p className="mt-0.5 text-xs text-text-muted">{hint}</p>}
    </div>
  );
}
