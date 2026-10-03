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

/** Warm palette: fg slate = Protected Queue, chart-grey = FIFO, amber secondary, sage sparingly, danger only for blocked/bots. */
export const C = {
  fg: "#33404b",
  grey: "#c9bba8",
  amber: "#e9b466",
  beige: "#f6eee3",
  success: "#5f8f70",
  danger: "#ad4a43",
  line: "#ecdfd0",
  muted: "#6b7680",
  surface: "#fffdf9",
};

const axis = { stroke: C.muted, tick: { fill: C.muted, fontSize: 12 }, tickLine: false, axisLine: { stroke: C.line } } as const;
const tooltip = {
  contentStyle: { background: C.surface, border: `1px solid ${C.line}`, borderRadius: 12, fontSize: 12, color: C.fg, boxShadow: "0 8px 24px -12px rgba(51,64,75,0.18)" },
  labelStyle: { color: C.muted, marginBottom: 4 },
  itemStyle: { fontVariantNumeric: "tabular-nums", color: C.fg },
  cursor: { fill: "rgba(51,64,75,0.04)", stroke: C.line },
} as const;

export type Series = { key: string; name: string; color: string; dashed?: boolean };
type Row = Record<string, string | number>;

export function ChartCard({ title, subtitle, right, children, className }: { title: string; subtitle?: string; right?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <Card className={cx("min-w-0 p-6 sm:p-8", className)}>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="serif text-[22px] font-semibold leading-tight">{title}</h2>
          {subtitle && <p className="mt-1 text-[13px] text-muted">{subtitle}</p>}
        </div>
        {right}
      </div>
      {children}
    </Card>
  );
}

export function Legend({ items }: { items: { name: string; color: string; value?: ReactNode }[] }) {
  return (
    <ul className="flex flex-wrap gap-x-5 gap-y-2 text-[13px] text-muted">
      {items.map((i) => (
        <li key={i.name} className="flex items-center gap-2">
          <span className="size-2 rounded-full" style={{ background: i.color }} aria-hidden />
          {i.name}
          {i.value !== undefined && <span className="num font-medium text-fg">{i.value}</span>}
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

export function Lines({ data, x, series, height = 260, label, fmt }: { data: Row[]; x: string; series: Series[]; height?: number; label: string; fmt?: (v: number) => string }) {
  const f = (v: unknown) => (fmt ? fmt(Number(v)) : Number(v).toLocaleString("en-US"));
  return (
    <Frame height={height} label={label}>
      <LineChart data={data} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
        <CartesianGrid stroke={C.line} vertical={false} />
        <XAxis dataKey={x} {...axis} minTickGap={32} />
        <YAxis {...axis} width={48} tickFormatter={f} />
        <Tooltip {...tooltip} formatter={f} />
        {series.map((s) => (
          <Line key={s.key} dataKey={s.key} name={s.name} stroke={s.color} strokeDasharray={s.dashed ? "4 4" : undefined} dot={false} strokeWidth={1.75} isAnimationActive={false} />
        ))}
      </LineChart>
    </Frame>
  );
}

export function Areas({ data, x, series, height = 240, label, stacked }: { data: Row[]; x: string; series: Series[]; height?: number; label: string; stacked?: boolean }) {
  return (
    <Frame height={height} label={label}>
      <AreaChart data={data} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
        <CartesianGrid stroke={C.line} vertical={false} />
        <XAxis dataKey={x} {...axis} minTickGap={40} />
        <YAxis {...axis} width={48} />
        <Tooltip {...tooltip} formatter={(v) => Number(v).toLocaleString("en-US", { maximumFractionDigits: 1 })} />
        {series.map((s) => (
          <Area key={s.key} dataKey={s.key} name={s.name} stackId={stacked ? "1" : undefined} stroke={s.color} fill={s.color} fillOpacity={0.12} strokeWidth={1.5} isAnimationActive={false} />
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
      <BarChart data={data} layout={horizontal ? "vertical" : "horizontal"} margin={{ top: 4, right: 8, left: 0, bottom: 0 }} barGap={4}>
        <CartesianGrid stroke={C.line} vertical={!!horizontal} horizontal={!horizontal} />
        {horizontal ? (
          <>
            <XAxis type="number" {...axis} tickFormatter={fmt} />
            <YAxis type="category" dataKey={x} {...axis} width={96} />
          </>
        ) : (
          <>
            <XAxis dataKey={x} {...axis} interval={0} />
            <YAxis {...axis} width={48} tickFormatter={fmt} />
          </>
        )}
        <Tooltip {...tooltip} formatter={fmt} />
        {series.map((s) => (
          <Bar key={s.key} dataKey={s.key} name={s.name} fill={s.color} stackId={stacked ? "1" : undefined} radius={4} maxBarSize={28} isAnimationActive={false} />
        ))}
      </BarChart>
    </Frame>
  );
}

export function Donut({ data, height = 200, label, center }: { data: { name: string; value: number; color: string }[]; height?: number; label: string; center?: ReactNode }) {
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
            strokeWidth={2}
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
