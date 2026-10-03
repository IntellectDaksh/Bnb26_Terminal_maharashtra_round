"use client";

import { useEffect, useRef, useState } from "react";
import type { Me } from "@/lib/contracts";
import { etaText, eventPath } from "@/lib/state/journey";
import { useJourney } from "@/lib/state/JourneyProvider";
import { serverNow } from "@/lib/time";
import { BackLink, LoadState, PageShell, RestoredNote, useRouteGuard } from "@/components/site/chrome";
import { fmtNum, PHASE_COPY } from "@/components/site/format";
import { cx, LoadingDots, ProgressBar, StatusBadge } from "@/components/ui";

type Queued = Extract<Me, { status: "QUEUED" }>;

/** Admission rate (positions/sec) measured from what we've actually observed over ~30s. */
function useAdmitRate(me: Queued | undefined) {
  const samples = useRef<{ t: number; a: number }[]>([]);
  const [rate, setRate] = useState<number | null>(null);
  const [stalled, setStalled] = useState(false);
  const ahead = me?.admitted_ahead;
  useEffect(() => {
    if (ahead === undefined) return;
    const now = serverNow();
    const s = samples.current;
    if (!s.length || s[s.length - 1].a !== ahead) s.push({ t: now, a: ahead });
    while (s.length > 2 && now - s[0].t > 30_000) s.shift();
    const first = s[0];
    const last = s[s.length - 1];
    setRate(s.length >= 3 && last.t > first.t ? ((last.a - first.a) / (last.t - first.t)) * 1000 : null);
  }, [ahead]);
  useEffect(() => {
    // no movement for 20s while admitting = paused or slow; say so instead of guessing
    const t = setInterval(() => {
      const s = samples.current;
      setStalled(s.length > 0 && serverNow() - s[s.length - 1].t > 20_000);
    }, 2_000);
    return () => clearInterval(t);
  }, []);
  return { rate, stalled };
}

const approx = (e: string) => (/^(About|Roughly) /.test(e) ? `~${e.replace(/^(About|Roughly) /, "")}` : e);

export default function QueuePage() {
  const me = useRouteGuard("queue");
  const { event, eventId, conn } = useJourney();
  const queued = me?.status === "QUEUED" ? me : undefined;
  const admitting = event?.phase === "ADMITTING";
  const { rate, stalled } = useAdmitRate(admitting ? queued : undefined);

  if (!me || !event) return <LoadState route="queue" />;

  const phase = PHASE_COPY[event.phase];
  const admitted = queued?.admitted_ahead ?? 0;
  const ahead = queued ? Math.max(0, queued.position - 1 - admitted) : 0;
  const inQueue = queued ? Math.max(0, queued.total - admitted) : event.registrations;
  const eta = queued && admitting ? etaText(queued.position, admitted, rate) : null;
  const wait = !queued ? "After the draw" : !admitting ? "Not started" : stalled ? "Line paused" : eta ? approx(eta) : "Measuring";

  const isLive = conn === "live";

  return (
    <PageShell className="pt-8 sm:pt-10">
      <div className="mx-auto max-w-4xl">
        <BackLink href={eventPath(eventId)}>{event.name}</BackLink>

        {/* Top Badges & Live Heartbeat Header */}
        <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2.5">
            <StatusBadge tone={phase.tone}>{phase.label}</StatusBadge>
            <RestoredNote>{queued ? "Position restored" : "Entry restored"}</RestoredNote>
          </div>

          {/* Live SSE connection heartbeat dot */}
          <div
            className={cx(
              "inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold border transition-all",
              isLive
                ? "bg-emerald-50 text-emerald-700 border-emerald-200/80"
                : "bg-amber-50 text-amber-700 border-amber-200/80"
            )}
            title={isLive ? "Connected to real-time event stream" : "Re-establishing real-time connection"}
          >
            <span className="relative flex size-2">
              {isLive ? (
                <>
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                  <span className="relative inline-flex size-2 rounded-full bg-emerald-600" />
                </>
              ) : (
                <span className="size-2 rounded-full bg-amber-500 animate-pulse" />
              )}
            </span>
            <span>{isLive ? "Live SSE Stream" : "Reconnecting SSE..."}</span>
          </div>
        </div>

        {/* Title Heading */}
        <div className="mt-8 text-center sm:text-left">
          <span className="eyebrow">Fair Drop Waiting Room</span>
          <h1 className="display mt-2 text-[clamp(2.5rem,6vw,4.5rem)]">
            {queued ? (
              <>
                You&apos;re in <em className="accent-italic">the queue.</em>
              </>
            ) : (
              <>
                You&apos;re in <em className="accent-italic">the pool.</em>
              </>
            )}
          </h1>
          <p className="mt-2 text-base text-zinc-600 max-w-2xl">
            {queued
              ? "Stay on this page. Your live position updates automatically in real-time."
              : event.phase === "REGISTRATION_OPEN"
                ? "Positions are shuffled at random once registration closes. When you entered doesn't give early priority."
                : "Registration is closed. The server is drawing randomized positions now."}
          </p>
        </div>

        {/* Central Waiting Room Glass Panel Card */}
        <section
          className="glass-panel relative mt-8 overflow-hidden rounded-3xl border border-zinc-200/80 p-8 sm:p-12 shadow-2xl shadow-emerald-900/5"
          aria-labelledby="pos-label"
        >
          <div className="absolute top-0 inset-x-0 h-1.5 bg-gradient-to-r from-emerald-500 via-teal-500 to-emerald-600" />

          {queued ? (
            <div>
              {/* Header inside card: Eyebrow + Adaptive ETA badge */}
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <div className="text-xs font-bold uppercase tracking-wider text-emerald-600" id="pos-label">
                    Your Verified Queue Position
                  </div>
                  <div className="text-xs text-zinc-500 mt-0.5">Assigned via audited random shuffle</div>
                </div>

                {/* Adaptive ETA badge */}
                <div className="flex items-center gap-2">
                  <span className="text-xs font-medium text-zinc-500">Estimated wait:</span>
                  <span
                    className={cx(
                      "inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-semibold border transition-all",
                      stalled
                        ? "bg-amber-50 text-amber-700 border-amber-200"
                        : eta === "You're next"
                          ? "bg-emerald-50 text-emerald-700 border-emerald-200/80 animate-pulse"
                          : "bg-zinc-100 text-zinc-800 border-zinc-200"
                    )}
                  >
                    <span
                      className={cx(
                        "size-1.5 rounded-full",
                        stalled ? "bg-amber-500" : eta === "You're next" ? "bg-emerald-500" : "bg-zinc-600"
                      )}
                    />
                    {wait}
                  </span>
                </div>
              </div>

              {/* Giant tabular position number */}
              <div className="my-8 text-center sm:text-left">
                <div
                  className="num text-7xl sm:text-8xl md:text-9xl font-bold text-zinc-900 tracking-tight leading-none"
                  aria-live="polite"
                >
                  #{fmtNum(queued.position)}
                </div>
                <div className="mt-2 text-sm text-zinc-500">
                  Out of <strong className="font-semibold text-zinc-900">{fmtNum(queued.total)}</strong> total participants registered
                </div>
              </div>

              {/* Live progress bar showing total registered vs admitted ahead */}
              <div className="mt-8 space-y-2.5 rounded-2xl border border-zinc-100 bg-zinc-50/70 p-5">
                <div className="flex items-center justify-between text-xs font-medium text-zinc-600">
                  <span className="flex items-center gap-1.5">
                    <span className="size-2 rounded-full bg-emerald-500" />
                    <span>Admitted ahead: <strong className="num text-zinc-900 font-semibold">{fmtNum(admitted)}</strong></span>
                  </span>
                  <span>Total registered: <strong className="num text-zinc-900 font-semibold">{fmtNum(queued.total)}</strong></span>
                </div>
                <ProgressBar
                  value={queued.position > 1 ? admitted / (queued.position - 1) : 1}
                  label="Progress toward your turn"
                  className="h-2.5"
                />
                <div className="flex items-center justify-between text-xs text-zinc-500 pt-1">
                  <span>
                    <strong className="num font-semibold text-zinc-900">{fmtNum(ahead)}</strong> participants ahead of you
                  </span>
                  <span>
                    <strong className="num font-semibold text-zinc-900">{fmtNum(event.seats_total)}</strong> seats in this drop
                  </span>
                </div>
              </div>

              {stalled && admitting && (
                <div className="mt-4 flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50/80 px-4 py-2.5 text-xs text-amber-800">
                  <span className="font-bold">Notice:</span> Batch admission is currently paused while participants claim seats. Your place is held safely.
                </div>
              )}
            </div>
          ) : (
            <div className="py-6 text-center">
              <div className="eyebrow" id="pos-label">
                Registration Pool Entry
              </div>
              <div className="num mt-3 text-2xl sm:text-3xl font-bold text-zinc-900 tracking-tight">
                {me.status === "REGISTERED" ? me.entry_id : ""}
              </div>
              <p className="mt-3 text-sm text-zinc-600 max-w-md mx-auto">
                Your entry is registered and protected. When the registration window concludes, all entries will be shuffled simultaneously.
              </p>
              <div className="mt-8 inline-flex items-center justify-center">
                <LoadingDots>
                  {event.phase === "REGISTRATION_OPEN" ? "Waiting for registration window to close" : "Drawing positions"}
                </LoadingDots>
              </div>
            </div>
          )}
        </section>

        {/* Realtime Telemetry Stats Grid */}
        <div className="mt-6 grid grid-cols-3 gap-3">
          <div className="rounded-2xl border border-zinc-200/80 bg-white p-4 sm:p-5 shadow-sm text-center sm:text-left">
            <div className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500">Queue Status</div>
            <div className="serif num mt-1 text-lg sm:text-2xl font-bold text-zinc-900">
              {admitting ? (stalled ? "Paused" : "Active") : phase.short}
            </div>
          </div>
          <div className="rounded-2xl border border-zinc-200/80 bg-white p-4 sm:p-5 shadow-sm text-center sm:text-left">
            <div className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500">Still In Queue</div>
            <div className="num mt-1 text-lg sm:text-2xl font-bold text-zinc-900">
              {fmtNum(inQueue)}
            </div>
          </div>
          <div className="rounded-2xl border border-zinc-200/80 bg-white p-4 sm:p-5 shadow-sm text-center sm:text-left">
            <div className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500">Wait Estimate</div>
            <div className="num mt-1 text-lg sm:text-2xl font-bold text-emerald-600">
              {queued && eta ? approx(eta) : wait}
            </div>
          </div>
        </div>

        {/* Supportive Grid: Why refreshing won't lose position and how batch admissions operate */}
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <div className="rounded-3xl border border-zinc-200/80 bg-white p-6 shadow-sm">
            <div className="flex size-9 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700 mb-4 border border-emerald-200/60">
              <svg viewBox="0 0 24 24" className="size-4.5" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                <path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
                <path d="M3 3v5h5" />
                <path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16" />
                <path d="M16 21h5v-5" />
              </svg>
            </div>
            <h3 className="text-sm font-semibold text-zinc-900">Safe to Refresh &amp; Reopen</h3>
            <p className="mt-1.5 text-xs text-zinc-600 leading-relaxed">
              Your queue position is tied to your cryptographic token and verified account. Closing this tab, refreshing, or switching networks will never forfeit your position.
            </p>
          </div>

          <div className="rounded-3xl border border-zinc-200/80 bg-white p-6 shadow-sm">
            <div className="flex size-9 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700 mb-4 border border-emerald-200/60">
              <svg viewBox="0 0 24 24" className="size-4.5" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
                <circle cx="9" cy="7" r="4" />
                <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
                <path d="M16 3.13a4 4 0 0 1 0 7.75" />
              </svg>
            </div>
            <h3 className="text-sm font-semibold text-zinc-900">Controlled Batch Admissions</h3>
            <p className="mt-1.5 text-xs text-zinc-600 leading-relaxed">
              Participants are admitted in small, metered batches rather than all at once. This avoids checkout bottlenecks and ensures the server never oversells seat capacity.
            </p>
          </div>

          <div className="rounded-3xl border border-zinc-200/80 bg-white p-6 shadow-sm sm:col-span-2 lg:col-span-1">
            <div className="flex size-9 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700 mb-4 border border-emerald-200/60">
              <svg viewBox="0 0 24 24" className="size-4.5" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                <circle cx="12" cy="12" r="10" />
                <polyline points="12 6 12 12 16 14" />
              </svg>
            </div>
            <h3 className="text-sm font-semibold text-zinc-900">Dedicated Claim Window</h3>
            <p className="mt-1.5 text-xs text-zinc-600 leading-relaxed">
              When your number is called, you are immediately allocated a reservation hold window (typically 5 minutes). No one can claim your seat while you checkout.
            </p>
          </div>
        </div>
      </div>
    </PageShell>
  );
}
