"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { BotProfile, type Comparison, type SimParams, type StrategyResult } from "@/lib/contracts";
import { PRESETS } from "@/lib/sim";
import { Button, Checkbox, Input, Skeleton, cx } from "@/components/ui";
import { defaultParams, useEventPoll, Notice, PROFILE_LABEL, PageHeader, Panel, TableWrap, download, int, ms, pct, td, th, toApiError } from "@/components/admin/shared";
import type { ApiError } from "@/lib/api";
import { Bars, C, ChartCard, Legend } from "@/components/charts";

const COHORT_LABEL: Record<string, string> = { human_fast: "Fast humans", human_avg: "Average humans", human_slow: "Slow humans", bot: "Bots" };

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

// ponytail: draws a summary card on canvas instead of rasterising recharts SVGs; headline numbers are what slides need.
function exportPng(c: Comparison) {
  const cv = document.createElement("canvas");
  cv.width = 1200;
  cv.height = 630;
  const g = cv.getContext("2d");
  if (!g) return;
  const font = "Inter, 'Helvetica Neue', Arial, sans-serif";
  g.fillStyle = "#FCF8F2";
  g.fillRect(0, 0, 1200, 630);
  g.fillStyle = "#33404B";
  g.font = `600 30px ${font}`;
  g.fillText("Queue fairness", 64, 84);
  g.fillStyle = "#6B7680";
  g.font = `400 20px ${font}`;
  g.fillText(`Simulation: ${int(c.params.humans)} humans, ${int(c.params.bots)} bots at ${c.params.bot_rps} req/s, ${int(c.params.seats)} seats`, 64, 120);
  g.fillStyle = "#ECDFD0";
  g.fillRect(64, 150, 1072, 1);
  g.fillRect(600, 190, 1, 360);
  [c.protected, c.fifo].forEach((s, i) => {
    const x = 64 + i * 576;
    g.fillStyle = "#6B7680";
    g.font = `600 15px ${font}`;
    g.fillText(i ? "TRADITIONAL FIFO" : "PROTECTED QUEUE", x, 210);
    g.fillStyle = "#33404B";
    g.font = `600 120px ${font}`;
    g.fillText(pct(s.bot_seat_share, 0), x, 340);
    g.font = `400 22px ${font}`;
    g.fillText("of seats went to bots", x, 380);
    g.fillStyle = "#6B7680";
    g.fillText(`Human share ${pct(s.human_seat_share, 0)}  ·  Jain ${s.jain_index.toFixed(2)}`, x, 440);
    g.fillText(`p50 ${ms(s.time_to_allocation_ms.p50)}  ·  p95 ${ms(s.time_to_allocation_ms.p95)}`, x, 476);
  });
  g.fillStyle = "#6B7680";
  g.font = `400 16px ${font}`;
  g.fillText("Fair Drop · simulated comparison, not a production measurement", 64, 590);
  cv.toBlob((b) => b && download("fair-drop-queue-comparison.png", b));
}

const humanShare = (s: StrategyResult) => s.human_seat_share;

function StrategyColumn({ title, s, color }: { title: string; s: StrategyResult; color: string }) {
  return (
    <ChartCard title={title} right={<span className="size-2.5 rounded-full" style={{ background: color }} aria-hidden />}>
      <dl className="grid grid-cols-2 gap-x-6 gap-y-6 sm:grid-cols-3">
        {[
          ["Bot seat share", pct(s.bot_seat_share)],
          ["Human seat share", pct(humanShare(s))],
          ["Jain index", s.jain_index.toFixed(3)],
          ["p50 to allocation", ms(s.time_to_allocation_ms.p50)],
          ["p95 to allocation", ms(s.time_to_allocation_ms.p95)],
        ].map(([l, v]) => (
          <div key={l}>
            <dt className="text-[13px] text-muted">{l}</dt>
            <dd className="num serif mt-1 text-3xl font-semibold">{v}</dd>
          </div>
        ))}
      </dl>
      <div className="mt-8 border-t border-line pt-6">
        <div className="mb-3 text-[13px] text-muted">Win rate by cohort</div>
        <Bars
          percent
          height={180}
          data={s.cohorts.map((k) => ({ cohort: COHORT_LABEL[k.cohort] ?? k.cohort, win: k.win_rate }))}
          x="cohort"
          series={[{ key: "win", name: "Win rate", color }]}
          label={`${title} win rate by cohort`}
        />
      </div>
      <div className="mt-8 border-t border-line pt-6">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <span className="text-[13px] text-muted">Allocation timing</span>
          <Legend items={[{ name: "Humans", color: C.fg }, { name: "Bots", color: C.danger }]} />
        </div>
        <Bars
          stacked
          height={180}
          data={s.time_to_allocation_ms.histogram}
          x="bucket"
          series={[
            { key: "humans", name: "Humans", color: C.fg },
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
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => setForm({ ...form, [k]: Math.max(0, Number(e.target.value) || 0) }),
  });
  const toggle = (p: BotProfile) => {
    const has = form.profiles.includes(p);
    const next = has ? form.profiles.filter((x) => x !== p) : [...form.profiles, p];
    if (next.length) setForm({ ...form, profiles: next });
  };

  return (
    <div className="rise">
      <PageHeader
        title={<>Queue <em>fairness</em></>}
        subtitle="Compare allocation behavior under identical traffic conditions."
        right={
          data && (
            <>
              <Button variant="secondary" size="sm" onClick={() => exportCsv(data)}>
                Export CSV
              </Button>
              <Button variant="secondary" size="sm" onClick={() => exportPng(data)}>
                Export PNG
              </Button>
            </>
          )
        }
      />

      <Panel title="Conditions" subtitle="Simulated run. Same seed and inputs produce the same result." className="mb-6">
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
          <fieldset className="mt-6">
            <legend className="mb-3 text-sm font-medium">Bot profiles</legend>
            <div className="flex flex-wrap gap-x-6 gap-y-3">
              {BotProfile.options.map((p) => (
                <Checkbox key={p} label={PROFILE_LABEL[p]} checked={form.profiles.includes(p)} onChange={() => toggle(p)} />
              ))}
            </div>
          </fieldset>
          <div className="mt-6 flex flex-wrap items-center gap-2 border-t border-line pt-6">
            <span className="mr-2 text-[13px] text-muted">Presets</span>
            {PRESETS.map((p) => (
              <Button key={p.condition} type="button" variant="secondary" size="sm" onClick={() => run({ ...form, bots: p.bots, bot_rps: p.bot_rps, profiles: p.profiles })}>
                {p.condition}
              </Button>
            ))}
            <Button type="submit" size="sm" loading={busy} className="ml-auto">
              Run comparison
            </Button>
          </div>
        </form>
      </Panel>

      {error && (
        <div className="mb-6">
          <Notice error={error} />
        </div>
      )}

      {!data ? (
        <div className="grid gap-6 lg:grid-cols-2">
          <Skeleton className="h-[560px]" />
          <Skeleton className="h-[560px]" />
        </div>
      ) : (
        <div className={cx("grid gap-6 transition-opacity", busy && "opacity-60")} aria-busy={busy}>
          <div className="grid gap-6 lg:grid-cols-2">
            <StrategyColumn title="Protected Queue" s={data.protected} color={C.fg} />
            <StrategyColumn title="Traditional FIFO" s={data.fifo} color={C.grey} />
          </div>
          <p className="text-[13px] text-muted">
            Jain index measures how evenly seats spread across cohorts: 1.0 is perfectly even, lower means one group took more than its share.
          </p>

          <Panel title="Attack condition → outcome" subtitle="Same humans and seats; bot volume and profiles vary per row.">
            <TableWrap>
              <table className="w-full min-w-[640px]">
                <thead>
                  <tr>
                    <th className={th}>Condition</th>
                    <th className={`${th} text-right`}>Bots</th>
                    <th className={`${th} text-right`}>Req/s per bot</th>
                    <th className={`${th} text-right`}>Bot share, FIFO</th>
                    <th className={`${th} text-right`}>Bot share, protected</th>
                    <th className={`${th} text-right`}>Jain, FIFO</th>
                    <th className={`${th} text-right`}>Jain, protected</th>
                  </tr>
                </thead>
                <tbody>
                  {data.conditions.map((r) => (
                    <tr key={r.condition}>
                      <td className={`${td} font-medium`}>{r.condition}</td>
                      <td className={`${td} num text-right`}>{int(r.bots)}</td>
                      <td className={`${td} num text-right`}>{r.bot_rps}</td>
                      <td className={`${td} num text-right text-muted`}>{pct(r.fifo_bot_share)}</td>
                      <td className={`${td} num text-right font-medium`}>{pct(r.protected_bot_share)}</td>
                      <td className={`${td} num text-right text-muted`}>{r.fifo_jain.toFixed(3)}</td>
                      <td className={`${td} num text-right font-medium`}>{r.protected_jain.toFixed(3)}</td>
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
