"use client";

import { useState } from "react";
import { api } from "@/lib/api";
import type { AttackEvent } from "@/lib/contracts";
import { Skeleton, cx } from "@/components/ui";
import {
  Empty,
  Notice,
  PROFILE_LABEL,
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

const LABEL: Record<AttackEvent["action"], string> = {
  allowed: "Bot challenge passed",
  flagged: "Suspicious session flagged",
  duplicate_identity: "Duplicate registration blocked",
  turnstile_failed: "Turnstile challenge failed",
  rate_limited: "Edge rate limit triggered",
  blocked_ip: "Blocked threat IP range",
};

const DOT: Record<AttackEvent["action"], string> = {
  allowed: "bg-emerald-500",
  flagged: "bg-amber-500",
  rate_limited: "bg-amber-500",
  duplicate_identity: "bg-red-500",
  turnstile_failed: "bg-red-500",
  blocked_ip: "bg-red-500",
};

export default function SecurityPage() {
  const { eventId } = useEventPoll();
  const attacks = usePoll(() => api.admin.attacks(eventId), 2000);
  const metrics = usePoll(() => api.admin.metrics(eventId), 2000);
  const [filter, setFilter] = useState<string>("all");

  const a = attacks.data;
  const m = metrics.data?.current;
  const error = attacks.error ?? metrics.error;

  const totalTurnstile = m ? m.turnstile_pass + m.turnstile_fail : 0;
  const passRate = totalTurnstile > 0 ? (m!.turnstile_pass / totalTurnstile) : 1;

  const filteredEvents = (a?.events ?? [])
    .filter((e) => filter === "all" || e.action === filter || e.profile === filter)
    .sort((x, y) => y.t.localeCompare(x.t));

  return (
    <div className="rise space-y-6">
      <PageHeader
        title={<>Security <em>Feed &amp; Bot Defense</em></>}
        subtitle="Real-time multi-factor bot detection, Turnstile challenge pass rates, and threat analysis."
      />

      {error && <Notice error={error} retryIn={attacks.retryIn || metrics.retryIn} />}

      {/* Top Security & Verification Metrics */}
      <section aria-label="Security Metrics" className="grid grid-cols-2 gap-4 lg:grid-cols-5">
        {!m ? (
          Array.from({ length: 5 }, (_, i) => (
            <div key={i} className="rounded-xl border border-line bg-surface p-5 shadow-sm">
              <Skeleton className="h-16" />
            </div>
          ))
        ) : (
          <>
            <div className="rounded-xl border border-line bg-surface p-5 shadow-sm hover:border-zinc-300 transition-colors">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500">Turnstile Solved</span>
                <span className="size-2 rounded-full bg-emerald-500" />
              </div>
              <div className="num mt-2 text-3xl font-semibold tracking-tight text-zinc-900">
                {int(m.turnstile_pass)}
              </div>
              <div className="mt-1 text-xs text-emerald-700 font-medium">Passed human check</div>
            </div>

            <div className="rounded-xl border border-line bg-surface p-5 shadow-sm hover:border-zinc-300 transition-colors">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500">Turnstile Failed</span>
                <span className="size-2 rounded-full bg-red-500" />
              </div>
              <div className="num mt-2 text-3xl font-semibold tracking-tight text-red-600">
                {int(m.turnstile_fail)}
              </div>
              <div className="mt-1 text-xs text-zinc-500 font-normal">Blocked challenge failure</div>
            </div>

            <div className="rounded-xl border border-line bg-surface p-5 shadow-sm hover:border-zinc-300 transition-colors">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500">Pass Rate</span>
                <span className="text-[10px] font-semibold text-emerald-600">Verified</span>
              </div>
              <div className="num mt-2 text-3xl font-semibold tracking-tight text-emerald-700">
                {pct(passRate, 1)}
              </div>
              <div className="mt-1 text-xs text-zinc-500 font-normal">Of total attempts</div>
            </div>

            <div className="rounded-xl border border-line bg-surface p-5 shadow-sm hover:border-zinc-300 transition-colors">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500">Rate Limited</span>
                <span className="size-2 rounded-full bg-amber-500" />
              </div>
              <div className="num mt-2 text-3xl font-semibold tracking-tight text-zinc-900">
                {int(m.rate_limited)}
              </div>
              <div className="mt-1 text-xs text-zinc-500 font-normal">HTTP 429 throttles</div>
            </div>

            <div className="rounded-xl border border-line bg-surface p-5 shadow-sm hover:border-zinc-300 transition-colors col-span-2 lg:col-span-1">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500">Flagged Sessions</span>
                <span className={m.flagged_sessions > 0 ? "size-2 rounded-full bg-amber-500" : "size-2 rounded-full bg-emerald-500"} />
              </div>
              <div className="num mt-2 text-3xl font-semibold tracking-tight text-zinc-900">
                {int(m.flagged_sessions)}
              </div>
              <div className="mt-1 text-xs text-zinc-500 font-normal">Device fingerprints monitored</div>
            </div>
          </>
        )}
      </section>

      {/* Main Content Grid */}
      <div className="grid gap-6 lg:grid-cols-5">
        {/* Real-time bot attempt audit logs */}
        <Panel
          title="Bot Attempt Audit Log"
          subtitle="Real-time stream of edge defense actions, refreshes every 2 seconds."
          className="lg:col-span-3"
          right={
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => setFilter("all")}
                className={cx(
                  "rounded-full px-2.5 py-1 text-[11px] font-medium transition-colors",
                  filter === "all" ? "bg-zinc-900 text-white" : "text-zinc-600 hover:bg-zinc-100"
                )}
              >
                All
              </button>
              <button
                onClick={() => setFilter("blocked_ip")}
                className={cx(
                  "rounded-full px-2.5 py-1 text-[11px] font-medium transition-colors",
                  filter === "blocked_ip" ? "bg-red-600 text-white" : "text-zinc-600 hover:bg-zinc-100"
                )}
              >
                Blocked IP
              </button>
              <button
                onClick={() => setFilter("turnstile_failed")}
                className={cx(
                  "rounded-full px-2.5 py-1 text-[11px] font-medium transition-colors",
                  filter === "turnstile_failed" ? "bg-red-600 text-white" : "text-zinc-600 hover:bg-zinc-100"
                )}
              >
                Failed Check
              </button>
            </div>
          }
        >
          {!a ? (
            <Skeleton className="h-80" />
          ) : filteredEvents.length === 0 ? (
            <Empty>No automated threat events recorded in current filter.</Empty>
          ) : (
            <ul className="divide-y divide-zinc-100 -my-3" aria-live="off">
              {filteredEvents.slice(0, 15).map((e) => (
                <li key={e.id} className="flex items-start gap-4 py-3.5 hover:bg-zinc-50/50 px-2 rounded-xl transition-colors">
                  <span className={cx("mt-1.5 size-2 shrink-0 rounded-full", DOT[e.action])} aria-hidden />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-semibold text-zinc-900">
                        {LABEL[e.action] ?? e.action}
                      </span>
                      <time dateTime={e.t} className="num text-xs font-mono text-zinc-400">
                        {hhmmss(e.t)}
                      </time>
                    </div>
                    <div className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-zinc-500 font-normal">
                      <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-[10px] font-medium text-zinc-700">
                        {PROFILE_LABEL[e.profile] ?? e.profile}
                      </span>
                      <span>·</span>
                      <span className="font-mono text-[11px] text-zinc-600">{e.session_id}</span>
                      <span>·</span>
                      <span className="text-zinc-500 truncate max-w-xs">{e.detail}</span>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        {/* Breakdown By Bot Profile */}
        <Panel
          title="Profile Breakdown"
          subtitle="Observed volume and defense efficacy per profile."
          className="lg:col-span-2"
        >
          {!a ? (
            <Skeleton className="h-60" />
          ) : a.by_profile.length === 0 ? (
            <Empty>No bot profiles observed in this window.</Empty>
          ) : (
            <TableWrap>
              <table className="w-full min-w-[340px]">
                <thead>
                  <tr className="border-b border-line bg-zinc-50/75">
                    <th className={th}>Profile</th>
                    <th className={`${th} text-right`}>Requests</th>
                    <th className={`${th} text-right`}>Blocked %</th>
                    <th className={`${th} text-right`}>Seats Won</th>
                  </tr>
                </thead>
                <tbody>
                  {a.by_profile.map((p) => (
                    <tr key={p.profile} className="hover:bg-zinc-50/60 transition-colors">
                      <td className={`${td} font-medium text-zinc-900 text-xs`}>
                        {PROFILE_LABEL[p.profile] ?? p.profile}
                      </td>
                      <td className={`${td} num text-right text-xs text-zinc-700`}>{int(p.requests)}</td>
                      <td className={`${td} num text-right text-xs font-medium text-emerald-700`}>
                        {pct(p.requests ? p.blocked / p.requests : 0)}
                      </td>
                      <td className={`${td} num text-right text-xs font-semibold`}>
                        {p.seats_won > 0 ? (
                          <span className="text-red-600 font-semibold">{int(p.seats_won)}</span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-emerald-600 font-semibold">
                            <span className="size-1.5 rounded-full bg-emerald-500" />0
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </TableWrap>
          )}

          <div className="mt-6 rounded-xl border border-zinc-100 bg-zinc-50/60 p-4">
            <div className="flex items-center gap-2 text-xs font-semibold text-zinc-800">
              <span className="size-2 rounded-full bg-emerald-500" />
              <span>Cryptographic Fair-Queue Guarantee</span>
            </div>
            <p className="mt-1 text-xs text-zinc-500 font-normal leading-relaxed">
              In Fair Drop, even bots that pass edge Turnstile solving enter the randomized queue shuffle alongside verified humans. Their win rate is bounded strictly by their human count (1 entry per verified ID).
            </p>
          </div>
        </Panel>
      </div>
    </div>
  );
}
