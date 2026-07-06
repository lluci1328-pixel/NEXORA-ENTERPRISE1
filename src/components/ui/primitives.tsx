import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

// --- Card -------------------------------------------------------------------

export function Card({
  children,
  className,
  hover = false,
}: {
  children: ReactNode;
  className?: string;
  hover?: boolean;
}) {
  return <div className={cn("card", hover && "card-hover", className)}>{children}</div>;
}

export function CardHeader({
  title,
  subtitle,
  action,
  icon,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  action?: ReactNode;
  icon?: ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-4 px-5 pt-5">
      <div className="flex items-center gap-3">
        {icon && (
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary-softer text-primary">
            {icon}
          </div>
        )}
        <div>
          <h3 className="text-[15px] font-semibold text-text">{title}</h3>
          {subtitle && <p className="mt-0.5 text-xs text-text-muted">{subtitle}</p>}
        </div>
      </div>
      {action}
    </div>
  );
}

// --- Badge ------------------------------------------------------------------

type Tone = "neutral" | "primary" | "success" | "warning" | "danger" | "purple";

const TONE_STYLES: Record<Tone, string> = {
  neutral: "bg-surface-inset text-text-secondary",
  primary: "bg-primary-soft text-primary-hover",
  success: "bg-success-soft text-success",
  warning: "bg-warning-soft text-warning",
  danger: "bg-danger-soft text-danger",
  purple: "bg-purple-soft text-purple",
};

export function Badge({
  children,
  tone = "neutral",
  className,
  dot = false,
}: {
  children: ReactNode;
  tone?: Tone;
  className?: string;
  dot?: boolean;
}) {
  return (
    <span className={cn("badge", TONE_STYLES[tone], className)}>
      {dot && <span className="h-1.5 w-1.5 rounded-full bg-current" />}
      {children}
    </span>
  );
}

// --- Avatar -----------------------------------------------------------------

export function Avatar({
  name,
  size = 36,
  className,
  tone = "primary",
}: {
  name: string;
  size?: number;
  className?: string;
  tone?: "primary" | "neutral" | "gradient";
}) {
  const chars = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]!.toUpperCase())
    .join("");
  const toneClass =
    tone === "gradient"
      ? "bg-gradient-to-br from-primary to-accent text-white"
      : tone === "neutral"
        ? "bg-surface-inset text-text-secondary"
        : "bg-primary-soft text-primary-hover";
  return (
    <div
      className={cn("flex shrink-0 items-center justify-center rounded-full font-semibold", toneClass, className)}
      style={{ width: size, height: size, fontSize: size * 0.36 }}
    >
      {chars}
    </div>
  );
}

// --- Empty state ------------------------------------------------------------

export function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-14 text-center">
      {icon && (
        <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-surface-inset text-text-muted">
          {icon}
        </div>
      )}
      <p className="text-sm font-semibold text-text">{title}</p>
      {description && <p className="mt-1 max-w-sm text-xs text-text-muted">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

// --- Section heading --------------------------------------------------------

export function PageHeading({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children?: ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-text">{title}</h1>
        {description && <p className="mt-1 text-sm text-text-secondary">{description}</p>}
      </div>
      {children && <div className="flex items-center gap-2">{children}</div>}
    </div>
  );
}

// --- Progress bar -----------------------------------------------------------

export function ProgressBar({ value, tone = "primary" }: { value: number; tone?: Tone }) {
  const color =
    tone === "success"
      ? "var(--success)"
      : tone === "warning"
        ? "var(--warning)"
        : tone === "danger"
          ? "var(--danger)"
          : tone === "purple"
            ? "var(--purple)"
            : "var(--primary)";
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface-inset">
      <div
        className="h-full rounded-full transition-all"
        style={{ width: `${Math.min(100, Math.max(0, value))}%`, background: color }}
      />
    </div>
  );
}
