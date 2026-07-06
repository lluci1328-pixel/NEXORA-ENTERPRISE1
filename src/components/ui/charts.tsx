"use client";

import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { formatCompactCurrency, formatNumber } from "@/lib/utils";

const AXIS = { stroke: "#8595a9", fontSize: 11, tickLine: false, axisLine: false } as const;
const GRID = "#e6edf9";
export const CHART_COLORS = ["#2563eb", "#0ea5e9", "#7c3aed", "#059669", "#d97706", "#dc2626", "#0891b2"];

function TooltipCard({
  active,
  payload,
  label,
  formatter,
}: {
  active?: boolean;
  payload?: { name: string; value: number; color: string }[];
  label?: string;
  formatter?: (v: number) => string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-border bg-surface px-3 py-2 shadow-lg">
      {label && <p className="mb-1 text-xs font-semibold text-text">{label}</p>}
      {payload.map((p) => (
        <div key={p.name} className="flex items-center gap-2 text-xs text-text-secondary">
          <span className="h-2 w-2 rounded-full" style={{ background: p.color }} />
          <span className="capitalize">{p.name}:</span>
          <span className="font-semibold text-text">
            {formatter ? formatter(p.value) : formatNumber(p.value)}
          </span>
        </div>
      ))}
    </div>
  );
}

export function RevenueAreaChart({
  data,
  currency = "INR",
}: {
  data: { date: string; revenue: number }[];
  currency?: string;
}) {
  return (
    <ResponsiveContainer width="100%" height={260}>
      <AreaChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id="revFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#2563eb" stopOpacity={0.28} />
            <stop offset="100%" stopColor="#2563eb" stopOpacity={0.02} />
          </linearGradient>
        </defs>
        <CartesianGrid vertical={false} stroke={GRID} />
        <XAxis
          dataKey="date"
          {...AXIS}
          tickFormatter={(d: string) => d.slice(5)}
          minTickGap={24}
        />
        <YAxis {...AXIS} tickFormatter={(v: number) => formatCompactCurrency(v, currency)} width={62} />
        <Tooltip content={<TooltipCard formatter={(v) => formatCompactCurrency(v, currency)} />} />
        <Area
          type="monotone"
          dataKey="revenue"
          stroke="#2563eb"
          strokeWidth={2.5}
          fill="url(#revFill)"
          dot={false}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}

export function LeadsLineChart({ data }: { data: { date: string; leads: number }[] }) {
  return (
    <ResponsiveContainer width="100%" height={220}>
      <LineChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
        <CartesianGrid vertical={false} stroke={GRID} />
        <XAxis dataKey="date" {...AXIS} tickFormatter={(d: string) => d.slice(5)} minTickGap={24} />
        <YAxis {...AXIS} width={32} allowDecimals={false} />
        <Tooltip content={<TooltipCard />} />
        <Line type="monotone" dataKey="leads" stroke="#0ea5e9" strokeWidth={2.5} dot={false} />
      </LineChart>
    </ResponsiveContainer>
  );
}

export function SimpleBarChart({
  data,
  dataKey,
  labelKey,
  height = 240,
  currency,
}: {
  data: Record<string, string | number>[];
  dataKey: string;
  labelKey: string;
  height?: number;
  currency?: string;
}) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
        <CartesianGrid vertical={false} stroke={GRID} />
        <XAxis dataKey={labelKey} {...AXIS} interval={0} />
        <YAxis
          {...AXIS}
          width={currency ? 62 : 32}
          tickFormatter={currency ? (v: number) => formatCompactCurrency(v, currency) : undefined}
          allowDecimals={false}
        />
        <Tooltip
          cursor={{ fill: "rgba(37,99,235,0.05)" }}
          content={
            <TooltipCard formatter={currency ? (v) => formatCompactCurrency(v, currency) : undefined} />
          }
        />
        <Bar dataKey={dataKey} radius={[6, 6, 0, 0]} maxBarSize={44}>
          {data.map((_, i) => (
            <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

export function DonutChart({
  data,
  height = 240,
}: {
  data: { name: string; value: number }[];
  height?: number;
}) {
  const total = data.reduce((s, d) => s + d.value, 0);
  return (
    <div className="flex items-center gap-4">
      <ResponsiveContainer width="55%" height={height}>
        <PieChart>
          <Pie
            data={data}
            dataKey="value"
            nameKey="name"
            innerRadius="62%"
            outerRadius="92%"
            paddingAngle={2}
            stroke="none"
          >
            {data.map((_, i) => (
              <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
            ))}
          </Pie>
          <Tooltip content={<TooltipCard />} />
        </PieChart>
      </ResponsiveContainer>
      <ul className="flex-1 space-y-2">
        {data.map((d, i) => (
          <li key={d.name} className="flex items-center justify-between text-xs">
            <span className="flex items-center gap-2 text-text-secondary">
              <span
                className="h-2.5 w-2.5 rounded-sm"
                style={{ background: CHART_COLORS[i % CHART_COLORS.length] }}
              />
              {d.name}
            </span>
            <span className="font-semibold text-text">
              {total > 0 ? Math.round((d.value / total) * 100) : 0}%
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function MiniSparkline({ data, color = "#2563eb" }: { data: number[]; color?: string }) {
  const chartData = data.map((v, i) => ({ i, v }));
  return (
    <ResponsiveContainer width="100%" height={40}>
      <AreaChart data={chartData} margin={{ top: 2, right: 0, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id={`spark-${color}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity={0.3} />
            <stop offset="100%" stopColor={color} stopOpacity={0} />
          </linearGradient>
        </defs>
        <Area type="monotone" dataKey="v" stroke={color} strokeWidth={2} fill={`url(#spark-${color})`} dot={false} />
      </AreaChart>
    </ResponsiveContainer>
  );
}
