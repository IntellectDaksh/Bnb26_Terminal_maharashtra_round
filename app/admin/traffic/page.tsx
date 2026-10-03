"use client";

import { useEffect, useState } from "react";
import { api, type ApiError } from "@/lib/api";
import { BotProfile, type SimParams } from "@/lib/contracts";
import { Button, Input, MetricCard, Skeleton, StatusBadge, cx } from "@/components/ui";
import { Notice, PageHeader, Panel, hhmmss, int, ms, pct, toApiError, usePoll, useEventPoll } from "@/components/admin/shared";
import { Areas, C, ChartCard, Legend } from "@/components/charts";

type Profile = NonNullable<SimParams["traffic_profile"]>;
const PROFILES: [Profile, string][] = [
  ["normal", "Normal"],
  ["high_traffic", "High Traffic"],
  ["adversarial", "Adversarial"],
];

function toParams(seats: number, profile: Profile, users: number, rps: number, duration: number): SimParams {
  const base = { seats, traffic_profile: profile, duration_s: duration };
  if (profile === "adversarial") return { ...base, humans: 0, bots: users, bot_rps: rps, profiles: [...BotProfile.options] };
  // humans-only traffic: bots 0; high traffic doubles request pressure
  return { ...base, humans: users, bots: 0, bot_rps: profile === "high_traffic" ? rps * 2 : rps, profiles: ["naive_spammer"] };
}

export default function TrafficPage() {
  const [profile, setProfile] = useState<Profile>("normal");
  const [users, setUsers] = useState(100);
  const [rps, setRps] = useState(50);
  const [duration, setDuration] = useState(60);
  // ponytail: run state is local to this tab; no GET /admin/simulator/status contract exists yet
  const [run, setRun] = useState<{ id: string; started: number; duration: number } | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<ApiError | null>(null);
  const { eventId, event } = useEventPoll();
  const metrics = usePoll(() => api.admin.metrics(eventId), 1000);

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
      const { run_id } = await api.admin.runSimulator(eventId, toParams(event.seats_total, profile, Math.max(0, users), Math.max(0, rps), d));
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
  const series = (metrics.data?.history ?? []).map((h) => ({ t: hhmmss(h.t), allowed: h.allowed_rps, blocked: h.blocked_rps }));

  return (
    <div className="rise">
      <PageHeader
        title={<>Traffic <em>simulator</em></>}
        subtitle="Generate synthetic load against the event and watch how the edge responds."
        badge={run ? <StatusBadge tone="live">Running</StatusBadge> : <StatusBadge>Idle</StatusBadge>}
      />

      <Panel title="Configuration" className="mb-6">
        <fieldset disabled={!!run}>
          <legend className="mb-3 text-sm font-medium">Traffic profile</legend>
          <div role="radiogroup" aria-label="Traffic profile" className="inline-flex flex-wrap rounded-full border border-line bg-bg-2 p-1">
            {PROFILES.map(([v, l]) => (
              <button
                key={v}
                type="button"
                role="radio"
                aria-checked={profile === v}
                onClick={() => setProfile(v)}
                className={cx("h-9 rounded-full px-4 text-sm transition-colors disabled:opacity-40", profile === v ? "bg-surface font-medium text-fg shadow-[0_0_0_1px_var(--line)]" : "text-muted hover:text-fg")}
              >
                {l}
              </button>
            ))}
          </div>
          <div className="mt-6 grid gap-4 sm:grid-cols-3">
            <Input label="Concurrent users" name="users" type="number" min={0} inputMode="numeric" value={users} onChange={(e) => setUsers(Number(e.target.value) || 0)} />
            <Input label="Requests / second" name="rps" type="number" min={0} inputMode="numeric" value={rps} onChange={(e) => setRps(Number(e.target.value) || 0)} />
            <Input label="Duration (sec)" name="duration" type="number" min={1} max={3600} inputMode="numeric" value={duration} onChange={(e) => setDuration(Number(e.target.value) || 1)} />
          </div>
        </fieldset>
        <p className="mt-4 text-[13px] text-muted">
          {profile === "adversarial"
            ? "Adversarial: every user is a scripted bot cycling through all five bot profiles."
            : profile === "high_traffic"
              ? "High traffic: human users only, at double the request rate."
              : "Normal: human users only, no bots."}
        </p>
        <div className="mt-6 flex flex-wrap items-center gap-3 border-t border-line pt-6">
          <Button onClick={start} loading={busy && !run} disabled={!!run}>
            Start simulation
          </Button>
          <Button variant="secondary" onClick={stop} loading={busy && !!run} disabled={!run}>
            Stop simulation
          </Button>
          {run && (
            <span className="num ml-auto text-sm text-muted" aria-live="polite">
              {elapsed}s elapsed · {run.duration - elapsed}s remaining
            </span>
          )}
        </div>
        {actionError && (
          <div className="mt-4">
            <Notice error={actionError} />
          </div>
        )}
      </Panel>

      {metrics.error && (
        <div className="mb-6">
          <Notice error={metrics.error} retryIn={metrics.retryIn} />
        </div>
      )}

      <section aria-label="Live metrics" className="mb-6 grid grid-cols-2 gap-px overflow-hidden rounded-[20px] border border-line bg-line shadow-[var(--shadow-soft)] md:grid-cols-3 xl:grid-cols-6">
        {!m
          ? Array.from({ length: 6 }, (_, i) => (
              <div key={i} className="bg-surface p-6">
                <Skeleton className="h-16" />
              </div>
            ))
          : (
              [
                ["Active requests", `${int(m.rps)}/s`],
                ["Successful requests", `${int(m.allowed_rps)}/s`],
                ["Blocked requests", `${int(m.blocked_rps)}/s`],
                ["Rate limited", int(m.rate_limited)],
                ["Avg response time", ms(m.latency_p50), "p50"],
                ["Error rate", pct(m.error_rate, 2)],
              ] as const
            ).map(([l, v, sub]) => <MetricCard key={l} label={l} value={v} sub={sub} className="bg-surface p-6" />)}
      </section>

      <ChartCard
        title="Requests per second"
        subtitle="Allowed versus blocked, sampled every second"
        right={<Legend items={[{ name: "Allowed", color: C.fg }, { name: "Blocked", color: C.danger }]} />}
      >
        {series.length ? (
          <Areas
            data={series}
            x="t"
            label="Requests per second over time, allowed versus blocked"
            series={[
              { key: "allowed", name: "Allowed", color: C.fg },
              { key: "blocked", name: "Blocked", color: C.danger },
            ]}
          />
        ) : (
          <Skeleton className="h-[240px]" />
        )}
      </ChartCard>
    </div>
  );
}
