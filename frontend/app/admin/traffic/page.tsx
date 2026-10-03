"use client";

import { useEffect, useState } from "react";
import { api, type ApiError } from "@/lib/api";
import { BotProfile, type SimParams } from "@/lib/contracts";
import { Button, Input, MetricCard, Skeleton, StatusBadge, cx } from "@/components/ui";
import {
  Notice,
  PageHeader,
  Panel,
  TableWrap,
  hhmmss,
  int,
  ms,
  pct,
  td,
  th,
  toApiError,
  usePoll,
  useEventPoll,
} from "@/components/admin/shared";
import { Areas, C, ChartCard, Legend, Lines } from "@/components/charts";

type Profile = NonNullable<SimParams["traffic_profile"]>;
const PROFILES: [Profile, string, string][] = [
  ["normal", "Normal", "Standard human traffic volume"],
  ["high_traffic", "High Traffic", "Surge human load at 2x rate"],
  ["adversarial", "Adversarial", "Multi-profile automated bot storm"],
];

function toParams(seats: number, profile: Profile, users: number, rps: number, duration: number): SimParams {
  const base = { seats, traffic_profile: profile, duration_s: duration };
  if (profile === "adversarial")
    return { ...base, humans: 0, bots: users, bot_rps: rps, profiles: [...BotProfile.options] };
  return {
    ...base,
    humans: users,
    bots: 0,
    bot_rps: profile === "high_traffic" ? rps * 2 : rps,
    profiles: ["naive_spammer"],
  };
}

export default function TrafficPage() {
  const [profile, setProfile] = useState<Profile>("normal");
  const [users, setUsers] = useState(100);
  const [rps, setRps] = useState(50);
  const [duration, setDuration] = useState(60);
  const [run, setRun] = useState<{ id: string; started: number; duration: number } | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<ApiError | null>(null);
  const { eventId, event } = useEventPoll();
  const metrics = usePoll(() => api.admin.metrics(eventId), 1000);
  const attacks = usePoll(() => api.admin.attacks(eventId), 2000);

  useEffect(() => {
    if (!run) return;
    const t = setInterval(() => {
      const n = Date.now();
      setNow(n);
      if (n - run.started >= run.duration * 1000) setRun(null);
    }, 250);
    return () => clearInterval(t);
  }, [run]);

  const start = async () => {
    setBusy(true);
    setActionError(null);
    try {
      const d = Math.min(3600, Math.max(1, duration));
      const { run_id } = await api.admin.runSimulator(
        eventId,
        toParams(event.seats_total, profile, Math.max(0, users), Math.max(0, rps), d)
      );
      const n = Date.now();
      setNow(n);
      setRun({ id: run_id, started: n, duration: d });
    } catch (e) {
      setActionError(toApiError(e));
    } finally {
      setBusy(false);
    }
  };

  const stop = async () => {
    setBusy(true);
    setActionError(null);
    try {
      await api.admin.stopSimulator(eventId);
      setRun(null);
    } catch (e) {
      setActionError(toApiError(e));
    } finally {
      setBusy(false);
    }
  };

  const m = metrics.data?.current;
  const elapsed = run ? Math.min(run.duration, Math.floor((now - run.started) / 1000)) : 0;
  const history = metrics.data?.history ?? [];

  // Allowed vs Blocked Areas
  const rpsSeries = history.map((h) => ({
    t: hhmmss(h.t),
    allowed: h.allowed_rps,
    blocked: h.blocked_rps,
  }));

  // Rate Limits & Latency Lines
  const rateLimitSeries = history.map((h) => ({
    t: hhmmss(h.t),
    rate_limited: h.rate_limited,
    latency: Math.round(h.latency_p50),
  }));

  const recentEvents = attacks.data?.events ?? [];

  return (
    <div className="rise space-y-6">
      <PageHeader
        title={<>Traffic &amp; <em>Telemetry Stream</em></>}
        subtitle="Simulate synthetic load against the edge, monitor rate limiting in real time, and analyze traffic telemetry."
        badge={
          run ? (
            <StatusBadge tone="live">Simulator Running</StatusBadge>
          ) : (
            <StatusBadge tone="neutral">Simulator Idle</StatusBadge>
          )
        }
      />

      {/* Simulator Control Panel */}
      <Panel
        title="Load Generator Configuration"
        subtitle="Inject synthetic traffic profiles to stress-test queue admission and edge rate-limits."
      >
        <fieldset disabled={!!run}>
          <legend className="mb-3 text-xs font-semibold uppercase tracking-wider text-zinc-500">
            Traffic Profile
          </legend>
          <div className="grid gap-3 sm:grid-cols-3">
            {PROFILES.map(([v, label, desc]) => (
              <button
                key={v}
                type="button"
                onClick={() => setProfile(v)}
                className={cx(
                  "flex flex-col text-left p-4 rounded-xl border transition-all cursor-pointer",
                  profile === v
                    ? "border-zinc-900 bg-bg-2 ring-1 ring-zinc-900"
                    : "border-line bg-zinc-50/50 hover:bg-zinc-100/60 text-zinc-600"
                )}
              >
                <div className="flex items-center justify-between">
                  <span className={cx("text-sm font-semibold", profile === v ? "text-fg" : "text-zinc-900")}>
                    {label}
                  </span>
                  <span
                    className={cx(
                      "size-2 rounded-full",
                      profile === v ? "bg-zinc-900" : "bg-zinc-300"
                    )}
                  />
                </div>
                <span className="mt-1 text-xs text-zinc-500 font-normal">{desc}</span>
              </button>
            ))}
          </div>

          <div className="mt-6 grid gap-4 sm:grid-cols-3">
            <Input
              label="Concurrent Users"
              name="users"
              type="number"
              min={0}
              inputMode="numeric"
              value={users}
              onChange={(e) => setUsers(Number(e.target.value) || 0)}
            />
            <Input
              label="Requests / Second"
              name="rps"
              type="number"
              min={0}
              inputMode="numeric"
              value={rps}
              onChange={(e) => setRps(Number(e.target.value) || 0)}
            />
            <Input
              label="Duration (Seconds)"
              name="duration"
              type="number"
              min={1}
              max={3600}
              inputMode="numeric"
              value={duration}
              onChange={(e) => setDuration(Number(e.target.value) || 1)}
            />
          </div>
        </fieldset>

        <div className="mt-6 flex flex-wrap items-center gap-3 border-t border-zinc-100 pt-5">
          <Button onClick={start} loading={busy && !run} disabled={!!run} variant="primary">
            Start Simulation
          </Button>
          <Button variant="secondary" onClick={stop} loading={busy && !!run} disabled={!run}>
            Stop Simulation
          </Button>
          {run && (
            <div className="ml-auto flex items-center gap-2 rounded-full bg-emerald-50 border border-emerald-200/80 px-3.5 py-1 text-xs font-semibold text-emerald-700">
              <span className="size-2 rounded-full bg-emerald-500 animate-pulse" />
              <span>
                {elapsed}s elapsed · {Math.max(0, run.duration - elapsed)}s remaining
              </span>
            </div>
          )}
        </div>

        {actionError && (
          <div className="mt-4">
            <Notice error={actionError} />
          </div>
        )}
      </Panel>

      {metrics.error && <Notice error={metrics.error} retryIn={metrics.retryIn} />}

      {/* Live Telemetry Metric Cards */}
      <section aria-label="Live metrics" className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-6">
        {!m ? (
          Array.from({ length: 6 }, (_, i) => (
            <div key={i} className="rounded-xl border border-line bg-surface p-5 shadow-sm">
              <Skeleton className="h-16" />
            </div>
          ))
        ) : (
          <>
            <MetricCard label="Active Requests" value={`${int(m.rps)}/s`} sub="Total edge ingress" />
            <MetricCard label="Allowed Traffic" value={`${int(m.allowed_rps)}/s`} sub="Passed verification" />
            <MetricCard label="Blocked Requests" value={`${int(m.blocked_rps)}/s`} sub="Threats dropped" />
            <MetricCard label="Rate Limited" value={int(m.rate_limited)} sub="HTTP 429 triggered" />
            <MetricCard label="Response Latency" value={ms(m.latency_p50)} sub="Median edge p50" />
            <MetricCard label="Error Rate" value={pct(m.error_rate, 2)} sub="5xx / 4xx ratio" />
          </>
        )}
      </section>

      {/* Real-time Telemetry Graphs */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Requests Per Second Area Chart */}
        <ChartCard
          title="Requests Per Second"
          subtitle="Allowed vs Blocked request volume sampled continuously"
          right={<Legend items={[{ name: "Allowed", color: C.emerald }, { name: "Blocked", color: C.danger }]} />}
        >
          {rpsSeries.length ? (
            <Areas
              data={rpsSeries}
              x="t"
              label="Requests per second over time, allowed versus blocked"
              series={[
                { key: "allowed", name: "Allowed", color: C.emerald },
                { key: "blocked", name: "Blocked", color: C.danger },
              ]}
            />
          ) : (
            <Skeleton className="h-[240px]" />
          )}
        </ChartCard>

        {/* Rate Limiting & Edge Latency Trend */}
        <ChartCard
          title="Rate Limits & Latency (ms)"
          subtitle="Rate limit counters and p50 edge response latency"
          right={
            <Legend
              items={[
                { name: "Rate Limited (req)", color: C.danger },
                { name: "Latency (ms)", color: C.grey },
              ]}
            />
          }
        >
          {rateLimitSeries.length ? (
            <Lines
              data={rateLimitSeries}
              x="t"
              label="Rate limited counts and edge latency over time"
              series={[
                { key: "rate_limited", name: "Rate Limited", color: C.danger },
                { key: "latency", name: "Latency (ms)", color: C.grey },
              ]}
            />
          ) : (
            <Skeleton className="h-[240px]" />
          )}
        </ChartCard>
      </div>

      {/* Live Traffic Telemetry Stream */}
      <Panel
        title="Live Edge Traffic Stream"
        subtitle="Real-time audit log of incoming connection challenges, token evaluations, and defensive blocks."
      >
        {!attacks.data ? (
          <Skeleton className="h-48" />
        ) : recentEvents.length === 0 ? (
          <div className="py-8 text-center text-sm text-zinc-400 font-normal">
            No anomalous traffic detected. Edge rate limits operating in normal bounds.
          </div>
        ) : (
          <TableWrap>
            <table className="w-full min-w-[620px]">
              <thead>
                <tr className="border-b border-line bg-zinc-50/75">
                  <th className={th}>Timestamp</th>
                  <th className={th}>Client Type</th>
                  <th className={th}>Session ID</th>
                  <th className={th}>Action Taken</th>
                  <th className={th}>Edge Diagnostic</th>
                </tr>
              </thead>
              <tbody>
                {[...recentEvents]
                  .sort((a, b) => b.t.localeCompare(a.t))
                  .slice(0, 10)
                  .map((ev) => (
                    <tr key={ev.id} className="hover:bg-zinc-50/60 transition-colors">
                      <td className={`${td} num text-xs text-zinc-400 font-mono`}>{hhmmss(ev.t)}</td>
                      <td className={`${td} font-medium text-zinc-900`}>
                        <span className="inline-flex items-center gap-1.5">
                          <span
                            className={cx(
                              "size-1.5 rounded-full",
                              ev.action === "allowed" ? "bg-emerald-500" : "bg-red-500"
                            )}
                          />
                          {ev.profile.replace(/_/g, " ")}
                        </span>
                      </td>
                      <td className={`${td} num text-xs text-zinc-500 font-mono`}>{ev.session_id}</td>
                      <td className={td}>
                        <span
                          className={cx(
                            "inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold",
                            ev.action === "allowed"
                              ? "bg-emerald-50 text-emerald-700 border border-emerald-200/70"
                              : "bg-red-50 text-red-700 border border-red-200/70"
                          )}
                        >
                          {ev.action.replace(/_/g, " ")}
                        </span>
                      </td>
                      <td className={`${td} text-xs text-zinc-500 max-w-xs truncate`}>{ev.detail}</td>
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
