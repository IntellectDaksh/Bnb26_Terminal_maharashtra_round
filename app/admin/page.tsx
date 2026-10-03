"use client";

import { api } from "@/lib/api";
import type { StrategyResult } from "@/lib/contracts";
import { MetricCard, Skeleton } from "@/components/ui";
import {
  AUDIT_LABEL,
  defaultParams,
  Empty,
  IntegrityLine,
  Notice,
  PageHeader,
  PhaseBadge,
  TableWrap,
  hhmm,
  int,
  isLivePhase,
  ms,
  pct,
  td,
  usePoll,
  useEventPoll,
} from "@/components/admin/shared";
import { Bars, C, ChartCard, Donut, Legend, Lines } from "@/components/charts";

/** Cumulative seats per histogram bucket; buckets are ordered by time already. */
function cumulative(s: StrategyResult) {
  let acc = 0;
  return s.time_to_allocation_ms.histogram.map((b) => (acc += b.humans + b.bots));
}

export default function Dashboard() {
  const event = useEventPoll();
  const { eventId } = event;
  const metrics = usePoll(() => api.admin.metrics(eventId), 2000);
  const alloc = usePoll(() => api.admin.allocations(eventId), 5000);
  const cmp = usePoll(() => api.admin.comparison(eventId, defaultParams(event.event.seats_total)), 60_000);
  const audit = usePoll(() => api.admin.audit(eventId), 4000);

  const m = metrics.data?.current;
  const e = event.data;
  const c = cmp.data;
  const error = metrics.error ?? event.error ?? alloc.error;

  // Donut: allowed traffic minus flagged share is "human"; flagged sessions are approximated as suspicious rps.
  const flaggedShare = m && m.active_sessions ? Math.min(1, m.flagged_sessions / m.active_sessions) : 0;
  const suspicious = m ? m.allowed_rps * flaggedShare : 0;
  const humanRps = m ? Math.max(0, m.allowed_rps - suspicious) : 0;
  const traffic = m
    ? [
        { name: "Human", value: humanRps, color: C.emerald },
        { name: "Suspicious", value: suspicious, color: C.zinc400 },
        { name: "Blocked", value: m.blocked_rps, color: C.danger },
      ]
    : [];
  const totalRps = traffic.reduce((a, b) => a + b.value, 0);

  const admissions = c
    ? (() => {
        const p = cumulative(c.protected);
        const f = cumulative(c.fifo);
        return c.protected.time_to_allocation_ms.histogram.map((b, i) => ({
          t: b.bucket,
          protected: p[i],
          fifo: f[i] ?? 0,
        }));
      })()
    : [];

  return (
    <div className="rise space-y-6">
      <PageHeader
        title={<>Telemetry &amp; <em>Live Status</em></>}
        subtitle="Real-time request metrics, admission velocity, and multi-tier bot defense telemetry."
        badge={e && <PhaseBadge phase={e.phase} />}
      />

      {error && <Notice error={error} retryIn={metrics.retryIn} />}

      {/* Real-time telemetry cards */}
      <section aria-label="Real-time telemetry" className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {!m ? (
          Array.from({ length: 4 }, (_, i) => (
            <div key={i} className="rounded-2xl border border-zinc-200/80 bg-white p-5 shadow-sm">
              <Skeleton className="h-16" />
            </div>
          ))
        ) : (
          <>
            <div className="rounded-2xl border border-zinc-200/80 bg-white p-5 shadow-sm hover:border-zinc-300 transition-colors">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500">Request Rate</span>
                <span className="inline-flex size-2 rounded-full bg-emerald-500 animate-pulse" />
              </div>
              <div className="num mt-2 text-3xl font-semibold tracking-tight text-zinc-900">
                {int(m.rps)} <span className="text-sm font-normal text-zinc-500">req/s</span>
              </div>
              <div className="mt-1 flex items-center gap-1.5 text-xs text-zinc-500 font-light truncate">
                <span className="text-emerald-600 font-medium">{int(humanRps)} human</span> ·{" "}
                <span className="text-zinc-500">{int(suspicious)} susp</span> ·{" "}
                <span className="text-red-600 font-medium">{int(m.blocked_rps)} block</span>
              </div>
            </div>

            <div className="rounded-2xl border border-zinc-200/80 bg-white p-5 shadow-sm hover:border-zinc-300 transition-colors">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500">Active Sessions</span>
                <span className="text-[10px] font-semibold text-zinc-400">Live</span>
              </div>
              <div className="num mt-2 text-3xl font-semibold tracking-tight text-zinc-900">
                {int(m.active_sessions)}
              </div>
              <div className="mt-1 text-xs text-zinc-500 font-light">
                {m.flagged_sessions > 0 ? (
                  <span className="text-amber-600 font-medium">{int(m.flagged_sessions)} flagged suspicious</span>
                ) : (
                  <span className="text-emerald-600 font-medium">All sessions healthy</span>
                )}
              </div>
            </div>

            <div className="rounded-2xl border border-zinc-200/80 bg-white p-5 shadow-sm hover:border-zinc-300 transition-colors">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500">Latency p50 / p95 / p99</span>
                <span className="text-[10px] font-semibold text-zinc-400">Edge</span>
              </div>
              <div className="num mt-2 text-3xl font-semibold tracking-tight text-zinc-900">
                {ms(m.latency_p50)}
              </div>
              <div className="mt-1 text-xs text-zinc-500 font-light">
                p95: <span className="font-medium text-zinc-700">{ms(m.latency_p95)}</span> · p99:{" "}
                <span className="font-medium text-zinc-700">{ms(m.latency_p99)}</span>
              </div>
            </div>

            <div className="rounded-2xl border border-zinc-200/80 bg-white p-5 shadow-sm hover:border-zinc-300 transition-colors">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500">Error Rate &amp; Limits</span>
                <span className={m.error_rate > 0.01 ? "size-2 rounded-full bg-red-500" : "size-2 rounded-full bg-emerald-500"} />
              </div>
              <div className="num mt-2 text-3xl font-semibold tracking-tight text-zinc-900">
                {pct(m.error_rate, 2)}
              </div>
              <div className="mt-1 text-xs text-zinc-500 font-light">
                Rate limited: <span className="font-medium text-zinc-700">{int(m.rate_limited)}</span> requests
              </div>
            </div>
          </>
        )}
      </section>

      {/* Seat capacity & integrity ribbon */}
      <div className="grid gap-4 lg:grid-cols-4">
        {!m || !e ? (
          <div className="col-span-full rounded-2xl border border-zinc-200/80 bg-white p-5 shadow-sm">
            <Skeleton className="h-10" />
          </div>
        ) : (
          <>
            <MetricCard
              label="Total Capacity"
              value={int(alloc.data?.seats_total ?? e.seats_total)}
              sub="Guaranteed venue inventory"
            />
            <MetricCard
              label="Confirmed Seats"
              value={int(m.seats_confirmed)}
              sub={`${int(m.seats_reserved)} holds in reservation window`}
            />
            <MetricCard
              label="Queue Backlog"
              value={int(Math.max(0, e.registrations - m.seats_confirmed - m.seats_reserved - m.reservations_expired))}
              sub={`${int(e.registrations)} total registrations`}
            />
            <div className="flex flex-col justify-between rounded-2xl border border-zinc-200/80 bg-white p-5 shadow-sm">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500">Database Integrity</span>
              <div className="my-2">
                <IntegrityLine duplicates={m.duplicate_allocations} oversold={m.oversold} />
              </div>
              <span className="text-[11px] text-zinc-400 font-light">Zero over-allocation invariant active</span>
            </div>
          </>
        )}
      </div>

      {/* Charts Grid */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Cumulative Capacity Timeline */}
        <ChartCard
          className="lg:col-span-2"
          title="Cumulative Capacity Timeline"
          subtitle="Cumulative seats allocated over time: Protected Queue vs Unprotected FIFO under identical load"
          right={
            <Legend
              items={[
                { name: "Protected Queue", color: C.emerald },
                { name: "Unprotected (FIFO)", color: C.grey },
              ]}
            />
          }
        >
          {c ? (
            <Lines
              data={admissions}
              x="t"
              label="Cumulative seats allocated per time bucket, protected queue versus FIFO"
              series={[
                { key: "protected", name: "Protected Queue", color: C.emerald },
                { key: "fifo", name: "Unprotected (FIFO)", color: C.grey, dashed: true },
              ]}
            />
          ) : cmp.error ? (
            <Notice error={cmp.error} retryIn={cmp.retryIn} />
          ) : (
            <Skeleton className="h-[260px]" />
          )}
        </ChartCard>

        {/* Traffic Sources Donut Chart */}
        <ChartCard
          title="Traffic Breakdown"
          subtitle="Real-time requests split by edge classification"
        >
          {m ? (
            <div className="grid gap-6">
              <Donut
                data={traffic}
                label="Traffic split between human, suspicious and blocked requests"
                center={
                  <div>
                    <div className="num text-3xl font-semibold tracking-tight text-zinc-900">{int(totalRps)}</div>
                    <div className="text-[11px] font-medium uppercase tracking-wider text-zinc-500">req / sec</div>
                  </div>
                }
              />
              <Legend
                items={traffic.map((t) => ({
                  ...t,
                  value: totalRps ? pct(t.value / totalRps, 0) : "0%",
                }))}
              />
            </div>
          ) : (
            <Skeleton className="h-[260px]" />
          )}
        </ChartCard>

        {/* Queue Fairness Comparison */}
        <ChartCard
          title="Strategy Comparison"
          subtitle="Simulation results under baseline adversarial attack mix"
        >
          {c ? (
            <div className="grid gap-6">
              <div>
                <div className="mb-2 text-xs font-medium text-zinc-500">Median Time to Allocation (p50)</div>
                <Bars
                  horizontal
                  height={110}
                  data={[
                    { s: "Protected", v: c.protected.time_to_allocation_ms.p50 / 1000 },
                    { s: "FIFO", v: c.fifo.time_to_allocation_ms.p50 / 1000 },
                  ]}
                  x="s"
                  series={[{ key: "v", name: "Seconds", color: C.emerald }]}
                  label={`Median time to allocation: protected ${ms(c.protected.time_to_allocation_ms.p50)}, FIFO ${ms(c.fifo.time_to_allocation_ms.p50)}`}
                />
              </div>
              <div className="border-t border-zinc-100 pt-4">
                <div className="mb-2 text-xs font-medium text-zinc-500">Bot Seat Share</div>
                <Bars
                  horizontal
                  percent
                  height={110}
                  data={[
                    { s: "Protected", v: c.protected.bot_seat_share },
                    { s: "FIFO", v: c.fifo.bot_seat_share },
                  ]}
                  x="s"
                  series={[{ key: "v", name: "Bot share", color: C.danger }]}
                  label={`Bot seat share: protected ${pct(c.protected.bot_seat_share)}, FIFO ${pct(c.fifo.bot_seat_share)}`}
                />
              </div>
            </div>
          ) : (
            <Skeleton className="h-[260px]" />
          )}
        </ChartCard>

        {/* Recent Audit Trail */}
        <ChartCard
          className="lg:col-span-2"
          title="Recent Audit Activity"
          subtitle="Tamper-evident log of batch admissions, holds, and blocked bot attempts"
        >
          {!audit.data ? (
            audit.error ? <Notice error={audit.error} retryIn={audit.retryIn} /> : <Skeleton className="h-48" />
          ) : audit.data.length === 0 ? (
            <Empty>No audit events recorded yet.</Empty>
          ) : (
            <TableWrap>
              <table className="w-full min-w-[500px]">
                <thead>
                  <tr className="border-b border-zinc-200/80 bg-zinc-50/75">
                    <th className="px-5 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-zinc-500">Time</th>
                    <th className="px-5 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-zinc-500">Event</th>
                    <th className="px-5 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-zinc-500">Detail</th>
                  </tr>
                </thead>
                <tbody>
                  {[...audit.data]
                    .sort((a, b) => b.t.localeCompare(a.t))
                    .slice(0, 8)
                    .map((r) => (
                      <tr key={r.id} className="hover:bg-zinc-50/60 transition-colors">
                        <td className={`${td} num text-xs text-zinc-400 font-mono`}>{hhmm(r.t)}</td>
                        <td className={`${td} font-medium text-zinc-900`}>
                          <span className="inline-flex items-center gap-1.5">
                            <span
                              className={`size-1.5 rounded-full ${
                                r.kind === "attack"
                                  ? "bg-red-500"
                                  : r.kind === "admission" || r.kind === "confirmation"
                                  ? "bg-emerald-500"
                                  : "bg-zinc-400"
                              }`}
                            />
                            {AUDIT_LABEL[r.kind]}
                          </span>
                        </td>
                        <td className={`${td} text-xs text-zinc-500`}>{r.message}</td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </TableWrap>
          )}
        </ChartCard>
      </div>
    </div>
  );
}
