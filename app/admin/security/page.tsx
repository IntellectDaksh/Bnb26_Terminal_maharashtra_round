"use client";

import { api } from "@/lib/api";
import type { AttackEvent } from "@/lib/contracts";
import { MetricCard, Skeleton, cx } from "@/components/ui";
import { Empty, Notice, PROFILE_LABEL, PageHeader, Panel, TableWrap, hhmmss, int, pct, td, th, usePoll, useEventPoll } from "@/components/admin/shared";

const LABEL: Record<AttackEvent["action"], string> = {
  allowed: "Bot challenge passed",
  flagged: "Suspicious IP flagged",
  duplicate_identity: "Duplicate registration blocked",
  turnstile_failed: "Human check failed",
  rate_limited: "Rate limit triggered",
  blocked_ip: "Blocked IP range",
};
const DOT: Record<AttackEvent["action"], string> = {
  allowed: "bg-success",
  flagged: "bg-chart-grey",
  rate_limited: "bg-chart-grey",
  duplicate_identity: "bg-danger",
  turnstile_failed: "bg-danger",
  blocked_ip: "bg-danger",
};

export default function SecurityPage() {
  const { eventId } = useEventPoll();
  const attacks = usePoll(() => api.admin.attacks(eventId), 2000);
  const metrics = usePoll(() => api.admin.metrics(eventId), 2000);
  const a = attacks.data;
  const m = metrics.data?.current;
  const error = attacks.error ?? metrics.error;

  return (
    <div className="rise">
      <PageHeader title={<>Security <em>activity</em></>} subtitle="What the edge allowed, challenged and blocked." />
      {error && (
        <div className="mb-6">
          <Notice error={error} retryIn={attacks.retryIn || metrics.retryIn} />
        </div>
      )}

      <section aria-label="Counters" className="mb-6 grid grid-cols-2 gap-px overflow-hidden rounded-[20px] border border-line bg-line shadow-[var(--shadow-soft)] lg:grid-cols-4">
        {!m
          ? Array.from({ length: 4 }, (_, i) => (
              <div key={i} className="bg-surface p-6">
                <Skeleton className="h-16" />
              </div>
            ))
          : (
              [
                ["Turnstile passed", m.turnstile_pass],
                ["Turnstile failed", m.turnstile_fail],
                ["Rate limited", m.rate_limited],
                ["Flagged sessions", m.flagged_sessions],
              ] as const
            ).map(([l, v]) => <MetricCard key={l} label={l} value={int(v)} className="bg-surface p-6" />)}
      </section>

      <div className="grid gap-6 lg:grid-cols-5">
        <Panel title="Activity" subtitle="Latest first, refreshes every 2 seconds" className="lg:col-span-3">
          {!a ? (
            <Skeleton className="h-80" />
          ) : a.events.length === 0 ? (
            <Empty>No automated traffic detected.</Empty>
          ) : (
            <ul className="-my-3" aria-live="off">
              {[...a.events]
                .sort((x, y) => y.t.localeCompare(x.t))
                .slice(0, 12)
                .map((e) => (
                  <li key={e.id} className="flex items-start gap-4 border-b border-line py-3 last:border-b-0">
                    <span className={cx("mt-[7px] size-1.5 shrink-0 rounded-full", DOT[e.action])} aria-hidden />
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-medium">{e.action === "flagged" && e.detail.toLowerCase().includes("session") ? "Session flagged" : LABEL[e.action]}</div>
                      <div className="mt-0.5 truncate text-[13px] text-muted">
                        {PROFILE_LABEL[e.profile]} · <span className="num">{e.session_id}</span>
                      </div>
                    </div>
                    <time dateTime={e.t} className="num shrink-0 text-[13px] text-muted">
                      {hhmmss(e.t)}
                    </time>
                  </li>
                ))}
            </ul>
          )}
        </Panel>

        <Panel title="By bot profile" className="lg:col-span-2">
          {!a ? (
            <Skeleton className="h-60" />
          ) : a.by_profile.length === 0 ? (
            <Empty>No profiles observed.</Empty>
          ) : (
            <TableWrap>
              <table className="w-full min-w-[360px]">
                <thead>
                  <tr>
                    <th className={th}>Profile</th>
                    <th className={`${th} text-right`}>Requests</th>
                    <th className={`${th} text-right`}>Blocked</th>
                    <th className={`${th} text-right`}>Seats won</th>
                  </tr>
                </thead>
                <tbody>
                  {a.by_profile.map((p) => (
                    <tr key={p.profile}>
                      <td className={`${td} font-medium`}>{PROFILE_LABEL[p.profile]}</td>
                      <td className={`${td} num text-right`}>{int(p.requests)}</td>
                      <td className={`${td} num text-right`}>{pct(p.requests ? p.blocked / p.requests : 0)}</td>
                      <td className={cx(td, "num text-right", p.seats_won > 0 && "text-danger")}>{int(p.seats_won)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </TableWrap>
          )}
        </Panel>
      </div>
    </div>
  );
}
