"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { BotProfile, type Comparison, type SimParams, type StrategyResult } from "@/lib/contracts";
import { PRESETS } from "@/lib/sim";
import { Button, Checkbox, Input, Skeleton, cx } from "@/components/ui";
import {
  defaultParams,
  useEventPoll,
  Notice,
  PROFILE_LABEL,
  PageHeader,
  Panel,
  TableWrap,
  download,
  int,
  ms,
  pct,
  td,
  th,
  toApiError,
} from "@/components/admin/shared";
import type { ApiError } from "@/lib/api";
import { Bars, C, ChartCard, Legend } from "@/components/charts";

const COHORT_LABEL: Record<string, string> = {
  human_fast: "Fast humans",
  human_avg: "Average humans",
  human_slow: "Slow humans",
  bot: "Bots",
};

function exportCsv(c: Comparison) {
  const q = (v: string | number) => `"${String(v).replace(/"/g, '""')}"`;
  const lines = [
    ["condition", "bots", "bot_rps", "fifo_bot_share", "protected_bot_share", "fifo_jain", "protected_jain"].join(","),
    ...c.conditions.map((r) => [q(r.condition), r.bots, r.bot_rps, r.fifo_bot_share, r.protected_bot_share, r.fifo_jain, r.protected_jain].join(",")),
    "",
    ["strategy", "cohort", "participants", "seats", "win_rate"].join(","),
    ...[c.fifo, c.protected].flatMap((s) => s.cohorts.map((k) => [s.strategy, q(k.cohort), k.participants, k.seats, k.win_rate].join(","))),
  ];
  download("fair-drop-queue-comparison.csv", new Blob([lines.join("\n")], { type: "text/csv" }));
}

function exportPng(c: Comparison) {
  const cv = document.createElement("canvas");
  cv.width = 1200;
  cv.height = 640;
  const g = cv.getContext("2d");
  if (!g) return;
  const font = "Inter, -apple-system, sans-serif";

  // Modern clean background
  g.fillStyle = "#ffffff";
  g.fillRect(0, 0, 1200, 640);

  // Top header
  g.fillStyle = "#059669";
  g.fillRect(64, 50, 4, 28);
  g.fillStyle = "#18181b";
  g.font = `600 28px ${font}`;
  g.fillText("Queue Fairness Benchmark", 76, 73);

  g.fillStyle = "#71717a";
  g.font = `400 15px ${font}`;
  g.fillText(
    `Simulated load: ${int(c.params.humans)} humans, ${int(c.params.bots)} bots @ ${c.params.bot_rps} req/s · ${int(c.params.seats)} available seats`,
    64,
    110
  );

  // Divider
  g.fillStyle = "#e4e4e7";
  g.fillRect(64, 135, 1072, 1);
  g.fillRect(600, 165, 1, 400);

  // Columns
  [
    { s: c.protected, title: "PROTECTED QUEUE (FAIR DROP)", color: "#059669" },
    { s: c.fifo, title: "TRADITIONAL FIFO QUEUE", color: "#71717a" },
  ].forEach(({ s, title, color }, i) => {
    const x = 64 + i * 576;
    g.fillStyle = color;
    g.font = `600 13px ${font}`;
    g.fillText(title, x, 185);

    g.fillStyle = color === "#059669" ? "#059669" : "#dc2626";
    g.font = `700 84px ${font}`;
    g.fillText(pct(s.bot_seat_share, 0), x, 275);

    g.fillStyle = "#18181b";
    g.font = `500 16px ${font}`;
    g.fillText("of seats captured by bots", x, 310);

    g.fillStyle = "#71717a";
    g.font = `400 15px ${font}`;
    g.fillText(`Human seat share: ${pct(s.human_seat_share, 1)}`, x, 350);
    g.fillText(`Jain's Fairness Index: ${s.jain_index.toFixed(3)} / 1.000`, x, 380);
    g.fillText(`Median time to allocation: ${ms(s.time_to_allocation_ms.p50)}`, x, 410);
    g.fillText(`95th percentile latency: ${ms(s.time_to_allocation_ms.p95)}`, x, 440);
  });

  // Footer
  g.fillStyle = "#e4e4e7";
  g.fillRect(64, 580, 1072, 1);
  g.fillStyle = "#a1a1aa";
  g.font = `400 13px ${font}`;
  g.fillText("Fair Drop Simulation Engine · Verified Deterministic Run", 64, 608);

  cv.toBlob((b) => b && download("fair-drop-queue-comparison.png", b));
}

/** Semi-circle visual gauge for Jain's Fairness Index with emerald accent */
function JainGauge({ value, label, subtitle, isProtected }: { value: number; label: string; subtitle: string; isProtected?: boolean }) {
  const clamped = Math.max(0, Math.min(1, value));
  // Semi-circle path: radius 40, center (50, 48)
  const r = 38;
  const circumference = Math.PI * r;
  const strokeDashoffset = circumference * (1 - clamped);

  return (
    <div className="flex flex-col items-center rounded-2xl border border-zinc-200/80 bg-zinc-50/60 p-5 text-center">
      <div className="relative h-24 w-44">
        <svg viewBox="0 0 100 58" className="w-full overflow-visible">
          {/* Background Arc */}
          <path
            d="M 12 48 A 38 38 0 0 1 88 48"
            fill="none"
            stroke="#e4e4e7"
            strokeWidth="9"
            strokeLinecap="round"
          />
          {/* Progress Arc */}
          <path
            d="M 12 48 A 38 38 0 0 1 88 48"
            fill="none"
            stroke={isProtected ? "#059669" : "#a1a1aa"}
            strokeWidth="9"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            className="transition-all duration-700 ease-out"
          />
        </svg>
        <div className="absolute inset-x-0 bottom-1 flex flex-col items-center">
          <span className={cx("num text-2xl font-bold tracking-tight", isProtected ? "text-emerald-700" : "text-zinc-700")}>
            {value.toFixed(3)}
          </span>
          <span className="text-[10px] uppercase font-semibold tracking-wider text-zinc-400">Score</span>
        </div>
      </div>
      <div className="mt-2">
        <div className="text-xs font-semibold text-zinc-900">{label}</div>
        <div className="text-[11px] text-zinc-500 font-light">{subtitle}</div>
      </div>
    </div>
  );
}

function StrategyColumn({ title, s, isProtected }: { title: string; s: StrategyResult; isProtected: boolean }) {
  const accentColor = isProtected ? C.emerald : C.grey;

  return (
    <ChartCard
      title={title}
      subtitle={isProtected ? "Cryptographic lottery & randomized shuffle" : "First-come first-served baseline"}
      right={
        <span
          className={cx(
            "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-semibold",
            isProtected ? "bg-emerald-50 text-emerald-700 border border-emerald-200/80" : "bg-zinc-100 text-zinc-600 border border-zinc-200"
          )}
        >
          <span className="size-1.5 rounded-full" style={{ background: accentColor }} />
          {isProtected ? "Active Strategy" : "Unprotected Baseline"}
        </span>
      }
    >
      {/* Metric Cards Grid */}
      <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-2xl border border-zinc-100 bg-zinc-50/70 p-4">
          <dt className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500">Bot Seat Share</dt>
          <dd className={cx("num mt-1 text-2xl font-bold", isProtected ? "text-emerald-700" : "text-red-600")}>
            {pct(s.bot_seat_share)}
          </dd>
        </div>

        <div className="rounded-2xl border border-zinc-100 bg-zinc-50/70 p-4">
          <dt className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500">Human Seat Share</dt>
          <dd className="num mt-1 text-2xl font-bold text-zinc-900">
            {pct(s.human_seat_share)}
          </dd>
        </div>

        <div className="rounded-2xl border border-zinc-100 bg-zinc-50/70 p-4">
          <dt className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500">p50 Allocation</dt>
          <dd className="num mt-1 text-2xl font-bold text-zinc-900">
            {ms(s.time_to_allocation_ms.p50)}
          </dd>
        </div>

        <div className="rounded-2xl border border-zinc-100 bg-zinc-50/70 p-4">
          <dt className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500">p95 Allocation</dt>
          <dd className="num mt-1 text-2xl font-bold text-zinc-900">
            {ms(s.time_to_allocation_ms.p95)}
          </dd>
        </div>
      </dl>

      {/* Speed cohort win rate bars */}
      <div className="mt-6 rounded-2xl border border-zinc-100 bg-zinc-50/40 p-5">
        <div className="mb-3 flex items-center justify-between">
          <span className="text-xs font-semibold uppercase tracking-wider text-zinc-600">Cohort Win Rate (Slow vs Avg vs Fast vs Bots)</span>
          <span className="text-[11px] text-zinc-400">Target: Equal human probability</span>
        </div>
        <Bars
          percent
          height={180}
          data={s.cohorts.map((k) => ({ cohort: COHORT_LABEL[k.cohort] ?? k.cohort, win: k.win_rate }))}
          x="cohort"
          series={[{ key: "win", name: "Win rate", color: accentColor }]}
          label={`${title} win rate by cohort`}
        />
      </div>

      {/* Time-to-allocation histogram */}
      <div className="mt-6 rounded-2xl border border-zinc-100 bg-zinc-50/40 p-5">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <span className="text-xs font-semibold uppercase tracking-wider text-zinc-600">Time-to-Allocation Histogram</span>
          <Legend items={[{ name: "Humans", color: C.emerald }, { name: "Bots", color: C.danger }]} />
        </div>
        <Bars
          stacked
          height={180}
          data={s.time_to_allocation_ms.histogram}
          x="bucket"
          series={[
            { key: "humans", name: "Humans", color: C.emerald },
            { key: "bots", name: "Bots", color: C.danger },
          ]}
          label={`${title} seats allocated per time bucket, humans versus bots`}
        />
      </div>
    </ChartCard>
  );
}

export default function QueuePage() {
  const { eventId, event } = useEventPoll();
  const [form, setForm] = useState<SimParams>(() => defaultParams(event.seats_total));
  const [params, setParams] = useState<SimParams>(form);
  const [data, setData] = useState<Comparison | null>(null);
  const [error, setError] = useState<ApiError | null>(null);
  const [busy, setBusy] = useState(true);

  useEffect(() => {
    let alive = true;
    api.admin
      .comparison(eventId, params)
      .then((d) => alive && (setData(d), setError(null)))
      .catch((e) => alive && setError(toApiError(e)))
      .finally(() => alive && setBusy(false));
    return () => {
      alive = false;
    };
  }, [eventId, params]);

  const run = (p: SimParams) => {
    setBusy(true);
    setForm(p);
    setParams(p);
  };

  const num = (k: "humans" | "bots" | "bot_rps" | "seats" | "seed") => ({
    name: k,
    type: "number",
    inputMode: "numeric" as const,
    min: k === "seats" ? 1 : 0,
    value: form[k] ?? 0,
    onChange: (e: React.ChangeEvent<HTMLInputElement>) =>
      setForm({ ...form, [k]: Math.max(0, Number(e.target.value) || 0) }),
  });

  const toggle = (p: BotProfile) => {
    const has = form.profiles.includes(p);
    const next = has ? form.profiles.filter((x) => x !== p) : [...form.profiles, p];
    if (next.length) setForm({ ...form, profiles: next });
  };

  return (
    <div className="rise space-y-6">
      <PageHeader
        title={<>Queue <em>Fairness Suite</em></>}
        subtitle="Cryptographic verification of fair allocation under high-contention bot surges."
        right={
          data && (
            <div className="flex items-center gap-2">
              <Button variant="secondary" size="sm" onClick={() => exportCsv(data)}>
                Export CSV
              </Button>
              <Button variant="secondary" size="sm" onClick={() => exportPng(data)}>
                Export PNG
              </Button>
            </div>
          )
        }
      />

      {/* Simulator parameters */}
      <Panel
        title="Simulation Conditions"
        subtitle="Deterministic execution model. Identical seeds and parameters produce reproducible outcomes."
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            run({ ...form, seats: Math.max(1, form.seats) });
          }}
        >
          <div className="grid grid-cols-2 gap-4 md:grid-cols-5">
            <Input label="Humans" {...num("humans")} />
            <Input label="Bots" {...num("bots")} />
            <Input label="Requests / sec per bot" {...num("bot_rps")} />
            <Input label="Seats" {...num("seats")} />
            <Input label="Seed" {...num("seed")} />
          </div>

          <fieldset className="mt-6 border-t border-zinc-100 pt-5">
            <legend className="mb-3 text-xs font-semibold uppercase tracking-wider text-zinc-500">
              Active Bot Profiles
            </legend>
            <div className="flex flex-wrap gap-x-6 gap-y-3">
              {BotProfile.options.map((p) => (
                <Checkbox
                  key={p}
                  label={PROFILE_LABEL[p]}
                  checked={form.profiles.includes(p)}
                  onChange={() => toggle(p)}
                />
              ))}
            </div>
          </fieldset>

          <div className="mt-6 flex flex-wrap items-center gap-2 border-t border-zinc-100 pt-5">
            <span className="mr-2 text-xs font-medium text-zinc-500">Presets:</span>
            {PRESETS.map((p) => (
              <Button
                key={p.condition}
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => run({ ...form, bots: p.bots, bot_rps: p.bot_rps, profiles: p.profiles })}
              >
                {p.condition}
              </Button>
            ))}
            <Button type="submit" size="sm" loading={busy} className="ml-auto">
              Run Comparison
            </Button>
          </div>
        </form>
      </Panel>

      {error && <Notice error={error} />}

      {!data ? (
        <div className="grid gap-6 lg:grid-cols-2">
          <Skeleton className="h-[560px]" />
          <Skeleton className="h-[560px]" />
        </div>
      ) : (
        <div className={cx("space-y-6 transition-opacity", busy && "opacity-60")} aria-busy={busy}>
          {/* Jain's Fairness Index Section */}
          <div className="rounded-3xl border border-zinc-200/80 bg-white p-6 sm:p-8 shadow-sm">
            <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold tracking-tight text-zinc-900">
                  Jain&apos;s Fairness Index Comparison
                </h2>
                <p className="mt-1 text-xs text-zinc-500 font-light">
                  Mathematical metric (0 to 1.0) evaluating equal opportunity across participants regardless of network speed or automation.
                </p>
              </div>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700 border border-emerald-200/60">
                1.0 = Perfect Equal Probability
              </span>
            </div>

            <div className="grid gap-6 sm:grid-cols-2">
              <JainGauge
                value={data.protected.jain_index}
                label="Protected Queue"
                subtitle="Equitable allocation across human cohorts"
                isProtected={true}
              />
              <JainGauge
                value={data.fifo.jain_index}
                label="Traditional FIFO"
                subtitle="Biased toward automated high-RPS actors"
                isProtected={false}
              />
            </div>
          </div>

          {/* Side-by-side Strategy Columns */}
          <div className="grid gap-6 lg:grid-cols-2">
            <StrategyColumn title="Protected Queue" s={data.protected} isProtected={true} />
            <StrategyColumn title="Traditional FIFO" s={data.fifo} isProtected={false} />
          </div>

          {/* Condition outcome table */}
          <Panel
            title="Attack Condition Matrix"
            subtitle="Benchmark across various bot counts and profiles with constant human population."
          >
            <TableWrap>
              <table className="w-full min-w-[640px]">
                <thead>
                  <tr className="border-b border-zinc-200/80 bg-zinc-50/75">
                    <th className={th}>Condition</th>
                    <th className={`${th} text-right`}>Bots</th>
                    <th className={`${th} text-right`}>Req/s per Bot</th>
                    <th className={`${th} text-right text-zinc-500`}>FIFO Bot Share</th>
                    <th className={`${th} text-right text-emerald-700 font-bold`}>Protected Bot Share</th>
                    <th className={`${th} text-right text-zinc-500`}>FIFO Jain</th>
                    <th className={`${th} text-right text-emerald-700 font-bold`}>Protected Jain</th>
                  </tr>
                </thead>
                <tbody>
                  {data.conditions.map((r) => (
                    <tr key={r.condition} className="hover:bg-zinc-50/60 transition-colors">
                      <td className={`${td} font-medium text-zinc-900`}>{r.condition}</td>
                      <td className={`${td} num text-right text-zinc-700`}>{int(r.bots)}</td>
                      <td className={`${td} num text-right text-zinc-700`}>{r.bot_rps}</td>
                      <td className={`${td} num text-right text-red-600 font-medium`}>{pct(r.fifo_bot_share)}</td>
                      <td className={`${td} num text-right text-emerald-600 font-bold`}>
                        {pct(r.protected_bot_share)}
                      </td>
                      <td className={`${td} num text-right text-zinc-500 font-mono`}>{r.fifo_jain.toFixed(3)}</td>
                      <td className={`${td} num text-right text-emerald-600 font-bold font-mono`}>
                        {r.protected_jain.toFixed(3)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </TableWrap>
          </Panel>
        </div>
      )}
    </div>
  );
}
