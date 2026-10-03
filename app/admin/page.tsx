"use client";

import { api } from "@/lib/api";
import type { StrategyResult } from "@/lib/contracts";
import { MetricCard, Skeleton, StatusBadge } from "@/components/ui";
import { AUDIT_LABEL, defaultParams, Empty, IntegrityLine, Notice, PageHeader, TableWrap, hhmm, int, isLivePhase, ms, pct, td, usePoll, useEventPoll } from "@/components/admin/shared";
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

  // Donut: allowed traffic minus a flagged share is "human"; flagged sessions are approximated as suspicious rps.
  const flaggedShare = m && m.active_sessions ? Math.min(1, m.flagged_sessions / m.active_sessions) : 0;
  const suspicious = m ? m.allowed_rps * flaggedShare : 0;
  const traffic = m
    ? [
        { name: "Human", value: Math.max(0, m.allowed_rps - suspicious), color: C.fg },
        { name: "Suspicious", value: suspicious, color: C.grey },
        { name: "Blocked", value: m.blocked_rps, color: C.danger },
      ]
    : [];
  const total = traffic.reduce((a, b) => a + b.value, 0);

  const admissions = c
    ? (() => {
        const p = cumulative(c.protected);
        const f = cumulative(c.fifo);
        return c.protected.time_to_allocation_ms.histogram.map((b, i) => ({ t: b.bucket, protected: p[i], fifo: f[i] ?? 0 }));
      })()
    : [];

  return (
    <div className="rise">
      <PageHeader
        title={<>Live event <em>dashboard</em></>}
        badge={e && (isLivePhase(e.phase) ? <StatusBadge tone="live">Live</StatusBadge> : <StatusBadge>{e.phase.replace(/_/g, " ").toLowerCase()}</StatusBadge>)}
      />
      {error && (
        <div className="mb-6">
          <Notice error={error} retryIn={metrics.retryIn} />
        </div>
      )}

      <section aria-label="Key figures" className="mb-6 grid grid-cols-2 gap-px overflow-hidden rounded-[20px] border border-line bg-line shadow-[var(--shadow-soft)] lg:grid-cols-4">
        {!m || !e ? (
          Array.from({ length: 4 }, (_, i) => (
            <div key={i} className="bg-surface p-6">
              <Skeleton className="h-16" />
            </div>
          ))
        ) : (
          <>
            <MetricCard className="bg-surface p-6" label="Total seats" value={int(alloc.data?.seats_total ?? e.seats_total)} />
            <MetricCard className="bg-surface p-6" label="Confirmed" value={int(m.seats_confirmed)} sub={`${int(m.seats_reserved)} reserved`} />
            <MetricCard
              className="bg-surface p-6"
              label="In queue"
              value={int(Math.max(0, e.registrations - m.seats_confirmed - m.seats_reserved - m.reservations_expired))}
              sub="Registrations not yet admitted (estimate)"
            />
            <MetricCard className="bg-surface p-6" label="Active users" value={int(m.active_sessions)} sub="Active sessions" />
          </>
        )}
      </section>

      <div className="mb-10 rounded-[20px] border border-line bg-surface px-6 py-4 shadow-[var(--shadow-soft)]">
        {m ? <IntegrityLine duplicates={m.duplicate_allocations} oversold={m.oversold} /> : <Skeleton className="h-5 w-64" />}
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <ChartCard
          className="lg:col-span-2"
          title="Admissions over time"
          subtitle="Cumulative seats allocated, simulated under identical traffic"
          right={<Legend items={[{ name: "Protected Queue", color: C.fg }, { name: "Unprotected (FIFO)", color: C.grey }]} />}
        >
          {c ? (
            <Lines
              data={admissions}
              x="t"
              label="Cumulative seats allocated per time bucket, protected queue versus FIFO"
              series={[
                { key: "protected", name: "Protected Queue", color: C.fg },
                { key: "fifo", name: "Unprotected (FIFO)", color: C.grey, dashed: true },
              ]}
            />
          ) : cmp.error ? (
            <Notice error={cmp.error} retryIn={cmp.retryIn} />
          ) : (
            <Skeleton className="h-[260px]" />
          )}
        </ChartCard>

        <ChartCard title="Traffic sources" subtitle="Requests per second, now">
          {m ? (
            <div className="grid gap-6">
              <Donut
                data={traffic}
                label="Traffic split between human, suspicious and blocked requests"
                center={
                  <div>
                    <div className="num serif text-3xl font-semibold">{int(total)}</div>
                    <div className="text-xs text-muted">req/s</div>
                  </div>
                }
              />
              <Legend items={traffic.map((t) => ({ ...t, value: total ? pct(t.value / total, 0) : "0%" }))} />
            </div>
          ) : (
            <Skeleton className="h-[260px]" />
          )}
        </ChartCard>

        <ChartCard title="Queue comparison" subtitle="Simulated, default attack mix">
          {c ? (
            <div className="grid gap-8">
              <div>
                <div className="mb-2 text-[13px] text-muted">Time to seat allocation, p50</div>
                <Bars
                  horizontal
                  height={110}
                  data={[
                    { s: "Protected", v: c.protected.time_to_allocation_ms.p50 / 1000 },
                    { s: "FIFO", v: c.fifo.time_to_allocation_ms.p50 / 1000 },
                  ]}
                  x="s"
                  series={[{ key: "v", name: "Seconds", color: C.fg }]}
                  label={`Median time to allocation: protected ${ms(c.protected.time_to_allocation_ms.p50)}, FIFO ${ms(c.fifo.time_to_allocation_ms.p50)}`}
                />
              </div>
              <div>
                <div className="mb-2 text-[13px] text-muted">Bot seat share</div>
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

        <ChartCard className="lg:col-span-2" title="Recent activity">
          {!audit.data ? (
            audit.error ? <Notice error={audit.error} retryIn={audit.retryIn} /> : <Skeleton className="h-48" />
          ) : audit.data.length === 0 ? (
            <Empty>Nothing has happened yet.</Empty>
          ) : (
            <TableWrap>
              <table className="w-full min-w-[480px]">
                <tbody>
                  {[...audit.data]
                    .sort((a, b) => b.t.localeCompare(a.t))
                    .slice(0, 8)
                    .map((r) => (
                      <tr key={r.id}>
                        <td className={`${td} num w-16 text-muted`}>{hhmm(r.t)}</td>
                        <td className={`${td} w-48 font-medium`}>{AUDIT_LABEL[r.kind]}</td>
                        <td className={`${td} text-muted`}>{r.message}</td>
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
