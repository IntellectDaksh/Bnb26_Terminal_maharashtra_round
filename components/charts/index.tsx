"use client";

import type { ReactElement, ReactNode } from "react";
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
import { Card, cx } from "@/components/ui";

/**
 * Modern zinc + emerald palette:
 * - Emerald (#059669, #10b981) for Protected Queue, successes and active highlights
 * - Dark zinc (#18181b, #27272a) for contrast and neutral series
 * - Muted zinc (#71717a, #a1a1aa) for FIFO baseline and axes
 * - Danger (#ef4444) for blocked requests and malicious bots
 */
export const C = {
  emerald: "#059669",
  emeraldLight: "#10b981",
  emeraldDark: "#047857",
  emeraldSoft: "#ecfdf5",
  zinc950: "#09090b",
  zinc900: "#18181b",
  zinc800: "#27272a",
  zinc700: "#3f3f46",
  zinc500: "#71717a",
  zinc400: "#a1a1aa",
  zinc200: "#e4e4e7",
  zinc100: "#f4f4f5",
  fg: "#059669", // Protected Queue primary (emerald)
  grey: "#71717a", // FIFO comparison / baseline (zinc-500)
  amber: "#f59e0b",
  success: "#059669",
  danger: "#ef4444",
  line: "#e4e4e7",
  muted: "#71717a",
  surface: "#ffffff",
};

const axis = {
  stroke: "#a1a1aa",
  tick: { fill: "#71717a", fontSize: 11, fontWeight: 500 },
  tickLine: false,
  axisLine: { stroke: "#e4e4e7" },
} as const;

const tooltip = {
  contentStyle: {
    backgroundColor: "rgba(255, 255, 255, 0.90)",
    backdropFilter: "blur(12px)",
    WebkitBackdropFilter: "blur(12px)",
    border: "1px solid rgba(228, 228, 231, 0.9)",
    borderRadius: "14px",
    fontSize: "12px",
    fontWeight: 500,
    color: "#18181b",
    boxShadow: "0 10px 25px -5px rgba(0, 0, 0, 0.08), 0 8px 10px -6px rgba(0, 0, 0, 0.04)",
    padding: "8px 14px",
  },
  labelStyle: { color: "#71717a", marginBottom: 4, fontWeight: 600, fontSize: "11px", letterSpacing: "0.02em" },
  itemStyle: { fontVariantNumeric: "tabular-nums", color: "#18181b", padding: "2px 0" },
  cursor: { fill: "rgba(24, 24, 27, 0.03)", stroke: "#e4e4e7" },
} as const;

export type Series = { key: string; name: string; color: string; dashed?: boolean };
type Row = Record<string, string | number>;

export function ChartCard({
  title,
  subtitle,
  right,
  children,
  className,
}: {
  title: string;
  subtitle?: string;
  right?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cx("rounded-3xl border border-zinc-200/80 bg-white p-6 sm:p-8 shadow-sm transition-all", className)}>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-lg font-semibold tracking-tight text-zinc-900">{title}</h2>
          {subtitle && <p className="mt-1 text-xs font-light text-zinc-500">{subtitle}</p>}
        </div>
        {right}
      </div>
      {children}
    </div>
  );
}

export function Legend({ items }: { items: { name: string; color: string; value?: ReactNode }[] }) {
  return (
    <ul className="flex flex-wrap items-center gap-x-5 gap-y-2 text-xs font-medium text-zinc-500">
      {items.map((i) => (
        <li key={i.name} className="flex items-center gap-2">
          <span className="size-2 rounded-full shrink-0 shadow-sm" style={{ background: i.color }} aria-hidden />
          <span className="text-zinc-600">{i.name}</span>
          {i.value !== undefined && <span className="num font-semibold text-zinc-900">{i.value}</span>}
        </li>
      ))}
    </ul>
  );
}

/** Fixed height wrapper so live updates never shift layout. */
function Frame({ height, label, children }: { height: number; label: string; children: ReactElement }) {
  return (
    <div style={{ height }} role="img" aria-label={label} className="min-w-0">
      <ResponsiveContainer width="100%" height="100%">
        {children}
      </ResponsiveContainer>
    </div>
  );
}

export function Lines({
  data,
  x,
  series,
  height = 260,
  label,
  fmt,
}: {
  data: Row[];
  x: string;
  series: Series[];
  height?: number;
  label: string;
  fmt?: (v: number) => string;
}) {
  const f = (v: unknown) => (fmt ? fmt(Number(v)) : Number(v).toLocaleString("en-US"));
  return (
    <Frame height={height} label={label}>
      <LineChart data={data} margin={{ top: 6, right: 12, left: 0, bottom: 0 }}>
        <CartesianGrid stroke={C.line} strokeDasharray="3 3" vertical={false} />
        <XAxis dataKey={x} {...axis} minTickGap={32} />
        <YAxis {...axis} width={48} tickFormatter={f} />
        <Tooltip {...tooltip} formatter={f} />
        {series.map((s) => (
          <Line
            key={s.key}
            dataKey={s.key}
            name={s.name}
            stroke={s.color}
            strokeDasharray={s.dashed ? "4 4" : undefined}
            dot={false}
            strokeWidth={2}
            isAnimationActive={false}
          />
        ))}
      </LineChart>
    </Frame>
  );
}

export function Areas({
  data,
  x,
  series,
  height = 240,
  label,
  stacked,
}: {
  data: Row[];
  x: string;
  series: Series[];
  height?: number;
  label: string;
  stacked?: boolean;
}) {
  return (
    <Frame height={height} label={label}>
      <AreaChart data={data} margin={{ top: 6, right: 12, left: 0, bottom: 0 }}>
        <CartesianGrid stroke={C.line} strokeDasharray="3 3" vertical={false} />
        <XAxis dataKey={x} {...axis} minTickGap={40} />
        <YAxis {...axis} width={48} />
        <Tooltip {...tooltip} formatter={(v) => Number(v).toLocaleString("en-US", { maximumFractionDigits: 1 })} />
        {series.map((s) => (
          <Area
            key={s.key}
            dataKey={s.key}
            name={s.name}
            stackId={stacked ? "1" : undefined}
            stroke={s.color}
            fill={s.color}
            fillOpacity={0.14}
            strokeWidth={1.75}
            isAnimationActive={false}
          />
        ))}
      </AreaChart>
    </Frame>
  );
}

export function Bars({
  data,
  x,
  series,
  height = 220,
  label,
  stacked,
  percent,
  horizontal,
}: {
  data: Row[];
  x: string;
  series: Series[];
  height?: number;
  label: string;
  stacked?: boolean;
  percent?: boolean;
  horizontal?: boolean;
}) {
  const fmt = (v: unknown) => (percent ? `${+(Number(v) * 100).toFixed(Number(v) < 0.1 ? 1 : 0)}%` : Number(v).toLocaleString("en-US"));
  return (
    <Frame height={height} label={label}>
      <BarChart
        data={data}
        layout={horizontal ? "vertical" : "horizontal"}
        margin={{ top: 6, right: 12, left: 0, bottom: 0 }}
        barGap={6}
      >
        <CartesianGrid stroke={C.line} strokeDasharray="3 3" vertical={!!horizontal} horizontal={!horizontal} />
        {horizontal ? (
          <>
            <XAxis type="number" {...axis} tickFormatter={fmt} />
            <YAxis type="category" dataKey={x} {...axis} width={100} />
          </>
        ) : (
          <>
            <XAxis dataKey={x} {...axis} interval={0} />
            <YAxis {...axis} width={48} tickFormatter={fmt} />
          </>
        )}
        <Tooltip {...tooltip} formatter={fmt} />
        {series.map((s) => (
          <Bar
            key={s.key}
            dataKey={s.key}
            name={s.name}
            fill={s.color}
            stackId={stacked ? "1" : undefined}
            radius={horizontal ? [0, 6, 6, 0] : [6, 6, 0, 0]}
            maxBarSize={28}
            isAnimationActive={false}
          />
        ))}
      </BarChart>
    </Frame>
  );
}

export function Donut({
  data,
  height = 200,
  label,
  center,
}: {
  data: { name: string; value: number; color: string }[];
  height?: number;
  label: string;
  center?: ReactNode;
}) {
  const empty = data.every((d) => d.value <= 0);
  return (
    <div className="relative">
      <Frame height={height} label={label}>
        <PieChart>
          <Pie
            data={empty ? [{ name: "No traffic", value: 1, color: C.line }] : data}
            dataKey="value"
            nameKey="name"
            innerRadius="68%"
            outerRadius="92%"
            stroke={C.surface}
            strokeWidth={3}
            isAnimationActive={false}
          >
            {(empty ? [{ color: C.line }] : data).map((d, i) => (
              <Cell key={i} fill={d.color} />
            ))}
          </Pie>
          {!empty && <Tooltip {...tooltip} formatter={(v) => Number(v).toLocaleString("en-US", { maximumFractionDigits: 1 })} />}
        </PieChart>
      </Frame>
      {center && <div className="pointer-events-none absolute inset-0 grid place-items-center text-center">{center}</div>}
    </div>
  );
}
