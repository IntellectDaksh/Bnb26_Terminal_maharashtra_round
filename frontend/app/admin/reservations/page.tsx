"use client";

import { api } from "@/lib/api";
import { MetricCard, ProgressBar, Skeleton, cx } from "@/components/ui";
import {
  Empty,
  IntegrityLine,
  Notice,
  PageHeader,
  Panel,
  TableWrap,
  hhmmss,
  int,
  pct,
  td,
  th,
  usePoll,
  useEventPoll,
} from "@/components/admin/shared";
import { C, ChartCard, Legend, Lines } from "@/components/charts";

export default function ReservationsPage() {
  const { eventId, event } = useEventPoll();
  const alloc = usePoll(() => api.admin.allocations(eventId), 3000);
  const metrics = usePoll(() => api.admin.metrics(eventId), 2000);
  const a = alloc.data;
  const m = metrics.data?.current;
  const error = alloc.error ?? metrics.error;

  const totalSeats = a?.seats_total ?? event.seats_total;
  const confirmedRatio = m ? m.seats_confirmed / Math.max(1, totalSeats) : 0;
  const reservationWindow = event.reservation_window_s;

  return (
    <div className="rise space-y-6">
      <PageHeader
        title={<>Seat <em>Reservations</em> &amp; Batches</>}
        subtitle="Staged batch releases, active reservation countdowns, and database integrity invariants."
      />

      {error && <Notice error={error} retryIn={alloc.retryIn || metrics.retryIn} />}

      {/* Primary Capacity & Progress Card */}
      <div className="rounded-xl border border-line bg-surface p-6 sm:p-8 shadow-sm">
        {!a || !m ? (
          <Skeleton className="h-32" />
        ) : (
          <>
            <div className="flex flex-wrap items-baseline justify-between gap-4">
              <div>
                <span className="num text-4xl sm:text-5xl font-semibold tracking-tight text-zinc-900">
                  {int(m.seats_confirmed)}
                </span>
                <span className="num ml-2.5 text-sm text-zinc-500 font-normal">
                  of {int(totalSeats)} total seats confirmed
                </span>
              </div>
              <div className="flex items-center gap-3">
                <span className="num text-xl font-semibold text-emerald-700">
                  {pct(confirmedRatio, 0)}
                </span>
                <span className="text-xs uppercase font-semibold tracking-wider text-zinc-400">Sold</span>
              </div>
            </div>

            <ProgressBar className="mt-4 h-2.5" value={confirmedRatio} label="Seats confirmed ratio" />

            <div className="mt-8 grid grid-cols-2 gap-4 border-t border-zinc-100 pt-6 md:grid-cols-4">
              <MetricCard
                label="Active Reservations"
                value={int(m.seats_reserved)}
                sub="Holds awaiting payment"
              />
              <MetricCard
                label="Expired Holds"
                value={int(m.reservations_expired)}
                sub="Recycled to next batch"
              />
              <MetricCard
                label="Current Batch"
                value={`#${int(m.admission_batch)}`}
                sub="Sequenced admission"
              />
              {/* Active reservation window countdown card */}
              <div className="rounded-xl border border-zinc-100 bg-emerald-50/40 p-4">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-emerald-800">
                    Hold Window
                  </span>
                  <span className="size-2 rounded-full bg-emerald-500 animate-pulse" />
                </div>
                <div className="num mt-2 text-2xl font-semibold text-emerald-900">
                  {reservationWindow}s
                </div>
                <div className="mt-1 text-xs text-emerald-700 font-normal truncate">
                  Auto-release on timeout
                </div>
              </div>
            </div>
          </>
        )}
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Allocation Timeline Chart */}
        <ChartCard
          className="lg:col-span-2"
          title="Allocation Lifecycle Timeline"
          subtitle="Real-time cumulative seats confirmed, currently held, and expired"
          right={
            <Legend
              items={[
                { name: "Confirmed", color: C.emerald },
                { name: "Reserved", color: C.grey },
                { name: "Expired", color: C.danger },
              ]}
            />
          }
        >
          {!a ? (
            <Skeleton className="h-[260px]" />
          ) : a.timeline.length < 2 ? (
            <Empty>No allocations yet. Timeline populates when admission batches start.</Empty>
          ) : (
            <Lines
              data={a.timeline.map((r) => ({
                t: hhmmss(r.t),
                confirmed: r.confirmed,
                reserved: r.reserved,
                expired: r.expired,
              }))}
              x="t"
              label="Confirmed, reserved and expired seats over time"
              series={[
                { key: "confirmed", name: "Confirmed", color: C.emerald },
                { key: "reserved", name: "Reserved", color: C.grey },
                { key: "expired", name: "Expired", color: C.danger, dashed: true },
              ]}
            />
          )}
        </ChartCard>

        {/* System Integrity Check Badge & Details */}
        <Panel
          title="System Integrity"
          subtitle={a ? `Verified at ${hhmmss(a.integrity.checked_at)}` : "Checking…"}
        >
          {!a ? (
            <Skeleton className="h-32" />
          ) : (
            <div className="space-y-5">
              <div>
                <IntegrityLine
                  duplicates={a.integrity.duplicate_allocations}
                  oversold={a.integrity.oversold}
                />
              </div>

              <div className="grid grid-cols-2 gap-3 border-t border-zinc-100 pt-5">
                <div className="rounded-xl border border-zinc-100 bg-zinc-50/70 p-3.5">
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
                    Duplicates
                  </span>
                  <div className="num mt-1 text-2xl font-semibold text-zinc-900">
                    {int(a.integrity.duplicate_allocations)}
                  </div>
                </div>
                <div className="rounded-xl border border-zinc-100 bg-zinc-50/70 p-3.5">
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
                    Oversold
                  </span>
                  <div className="num mt-1 text-2xl font-semibold text-zinc-900">
                    {int(a.integrity.oversold)}
                  </div>
                </div>
              </div>

              <p className="text-xs text-zinc-500 font-normal leading-relaxed">
                Guaranteed by single-row Postgres constraints and atomic conditional updates. Double allocation is structurally impossible.
              </p>
            </div>
          )}
        </Panel>
      </div>

      {/* Batch Allocation Progress */}
      <Panel
        title="Batch Allocation Progress"
        subtitle="Ordered admission waves. Seats from expired reservations are re-admitted in subsequent batches."
      >
        {!a ? (
          <Skeleton className="h-40" />
        ) : a.batches.length === 0 ? (
          <Empty>No admission batches released yet.</Empty>
        ) : (
          <TableWrap>
            <table className="w-full min-w-[560px]">
              <thead>
                <tr className="border-b border-line bg-zinc-50/75">
                  <th className={th}>Batch #</th>
                  <th className={th}>Admitted Time</th>
                  <th className={`${th} text-right`}>Batch Size</th>
                  <th className={`${th} text-right`}>Confirmed</th>
                  <th className={`${th} text-right`}>Expired</th>
                  <th className={`${th} text-right`}>Conversion</th>
                </tr>
              </thead>
              <tbody>
                {[...a.batches].reverse().map((b) => {
                  const conv = b.size > 0 ? (b.confirmed / b.size) * 100 : 0;
                  return (
                    <tr key={b.batch} className="hover:bg-zinc-50/60 transition-colors">
                      <td className={`${td} font-semibold text-zinc-900`}>Batch #{b.batch}</td>
                      <td className={`${td} num text-xs text-zinc-500 font-mono`}>{hhmmss(b.admitted_at)}</td>
                      <td className={`${td} num text-right text-zinc-800`}>{int(b.size)}</td>
                      <td className={`${td} num text-right text-emerald-600 font-medium`}>{int(b.confirmed)}</td>
                      <td className={`${td} num text-right text-zinc-400`}>{int(b.expired)}</td>
                      <td className={`${td} num text-right font-medium text-zinc-900`}>
                        <span className="inline-flex items-center gap-1.5">
                          <span
                            className={cx(
                              "size-1.5 rounded-full",
                              conv > 70 ? "bg-emerald-500" : conv > 30 ? "bg-amber-500" : "bg-zinc-400"
                            )}
                          />
                          {conv.toFixed(0)}%
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </TableWrap>
        )}
      </Panel>
    </div>
  );
}
