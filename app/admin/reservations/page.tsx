"use client";

import { api } from "@/lib/api";
import { MetricCard, ProgressBar, Skeleton } from "@/components/ui";
import { Empty, IntegrityLine, Notice, PageHeader, Panel, TableWrap, hhmmss, int, pct, td, th, usePoll, useEventPoll } from "@/components/admin/shared";
import { C, ChartCard, Legend, Lines } from "@/components/charts";

export default function ReservationsPage() {
  const { eventId } = useEventPoll();
  const alloc = usePoll(() => api.admin.allocations(eventId), 3000);
  const metrics = usePoll(() => api.admin.metrics(eventId), 2000);
  const a = alloc.data;
  const m = metrics.data?.current;
  const error = alloc.error ?? metrics.error;

  return (
    <div className="rise">
      <PageHeader title={<>Seat <em>reservations</em></>} subtitle="Seat holds, confirmations and expiries across admission batches." />
      {error && (
        <div className="mb-6">
          <Notice error={error} retryIn={alloc.retryIn || metrics.retryIn} />
        </div>
      )}

      <div className="mb-6 rounded-[20px] border border-line bg-surface p-6 shadow-[var(--shadow-soft)] sm:p-8">
        {!a || !m ? (
          <Skeleton className="h-28" />
        ) : (
          <>
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <div>
                <span className="num serif text-[48px] font-semibold leading-none">{int(m.seats_confirmed)}</span>
                <span className="num ml-2 text-muted">of {int(a.seats_total)} seats confirmed</span>
              </div>
              <span className="num text-sm text-muted">{pct(m.seats_confirmed / Math.max(1, a.seats_total), 0)}</span>
            </div>
            <ProgressBar className="mt-4" value={m.seats_confirmed / Math.max(1, a.seats_total)} label="Seats confirmed" />
            <div className="mt-8 grid grid-cols-2 gap-6 border-t border-line pt-6 md:grid-cols-3">
              <MetricCard label="Active reservations" value={int(m.seats_reserved)} />
              <MetricCard label="Expired" value={int(m.reservations_expired)} />
              <MetricCard label="Admission batch" value={int(m.admission_batch)} />
            </div>
          </>
        )}
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <ChartCard
          className="lg:col-span-2"
          title="Allocation timeline"
          subtitle="Running totals"
          right={
            <Legend
              items={[
                { name: "Confirmed", color: C.fg },
                { name: "Reserved", color: C.grey },
                { name: "Expired", color: C.danger },
              ]}
            />
          }
        >
          {!a ? (
            <Skeleton className="h-[260px]" />
          ) : a.timeline.length < 2 ? (
            <Empty>No allocations yet. The timeline fills once admission starts.</Empty>
          ) : (
            <Lines
              data={a.timeline.map((r) => ({ t: hhmmss(r.t), confirmed: r.confirmed, reserved: r.reserved, expired: r.expired }))}
              x="t"
              label="Confirmed, reserved and expired seats over time"
              series={[
                { key: "confirmed", name: "Confirmed", color: C.fg },
                { key: "reserved", name: "Reserved", color: C.grey },
                { key: "expired", name: "Expired", color: C.danger, dashed: true },
              ]}
            />
          )}
        </ChartCard>

        <Panel title="Integrity" subtitle={a ? `Checked ${hhmmss(a.integrity.checked_at)}` : undefined}>
          {!a ? (
            <Skeleton className="h-32" />
          ) : (
            <div className="grid gap-6">
              <IntegrityLine duplicates={a.integrity.duplicate_allocations} oversold={a.integrity.oversold} />
              <dl className="grid grid-cols-2 gap-6 border-t border-line pt-6">
                <MetricCard label="Duplicate allocations" value={int(a.integrity.duplicate_allocations)} />
                <MetricCard label="Oversold seats" value={int(a.integrity.oversold)} />
              </dl>
              <p className="text-[13px] text-muted">Both must stay at zero. Each seat is allocated once, enforced by a database constraint.</p>
            </div>
          )}
        </Panel>
      </div>

      <Panel title="Admission batches" className="mt-6">
        {!a ? (
          <Skeleton className="h-40" />
        ) : a.batches.length === 0 ? (
          <Empty>No batches admitted yet.</Empty>
        ) : (
          <TableWrap>
            <table className="w-full min-w-[520px]">
              <thead>
                <tr>
                  <th className={th}>Batch</th>
                  <th className={th}>Admitted at</th>
                  <th className={`${th} text-right`}>Size</th>
                  <th className={`${th} text-right`}>Confirmed</th>
                  <th className={`${th} text-right`}>Expired</th>
                </tr>
              </thead>
              <tbody>
                {[...a.batches].reverse().map((b) => (
                  <tr key={b.batch}>
                    <td className={`${td} num font-medium`}>#{b.batch}</td>
                    <td className={`${td} num text-muted`}>{hhmmss(b.admitted_at)}</td>
                    <td className={`${td} num text-right`}>{int(b.size)}</td>
                    <td className={`${td} num text-right`}>{int(b.confirmed)}</td>
                    <td className={`${td} num text-right text-muted`}>{int(b.expired)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableWrap>
        )}
      </Panel>
    </div>
  );
}
