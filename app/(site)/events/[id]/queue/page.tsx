"use client";

import { useEffect, useRef, useState } from "react";
import type { Me } from "@/lib/contracts";
import { etaText, eventPath } from "@/lib/state/journey";
import { useJourney } from "@/lib/state/JourneyProvider";
import { serverNow } from "@/lib/time";
import { QueueArt } from "@/components/illustrations";
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

const approx = (e: string) => (/^(About|Roughly) /.test(e) ? `~ ${e.replace(/^(About|Roughly) /, "")}` : e);

export default function QueuePage() {
  const me = useRouteGuard("queue");
  const { event, eventId } = useJourney();
  const queued = me?.status === "QUEUED" ? me : undefined;
  const admitting = event?.phase === "ADMITTING";
  const { rate, stalled } = useAdmitRate(admitting ? queued : undefined);

  if (!me || !event) return <LoadState route="queue" />;

  const phase = PHASE_COPY[event.phase];
  const admitted = queued?.admitted_ahead ?? 0;
  const ahead = queued ? Math.max(0, queued.position - 1 - admitted) : 0;
  const inQueue = queued ? Math.max(0, queued.total - admitted) : event.registrations;
  const eta = queued && admitting ? etaText(queued.position, admitted, rate) : null;
  const wait = !queued ? "After the draw" : !admitting ? "Not started" : stalled ? "Paused" : eta ? approx(eta) : "Measuring";

  return (
    <PageShell className="pt-8 sm:pt-10">
      <BackLink href={eventPath(eventId)}>{event.name}</BackLink>

      <div className="mx-auto mt-8 max-w-3xl text-center">
        <div className="flex flex-wrap items-center justify-center gap-3">
          <StatusBadge tone={phase.tone}>{phase.label}</StatusBadge>
          <RestoredNote>{queued ? "Position restored" : "Entry restored"}</RestoredNote>
        </div>
        <h1 className="display mt-6 text-[clamp(2.8rem,7vw,5rem)]">
          {queued ? (
            <>
              You&apos;re in <em>the queue.</em>
            </>
          ) : (
            <>
              You&apos;re in <em>the pool.</em>
            </>
          )}
        </h1>
        <p className="mx-auto mt-4 max-w-md text-lg text-muted">
          {queued
            ? "Stay on this page. Your position updates on its own."
            : event.phase === "REGISTRATION_OPEN"
              ? "Positions are drawn at random when registration closes. When you joined doesn't matter."
              : "Registration has closed. The server is drawing positions now."}
        </p>
      </div>

      <QueueArt className="mx-auto mt-8 h-36 w-full max-w-3xl overflow-hidden rounded-t-[26px] sm:h-44" />

      <section className="rise mx-auto max-w-3xl rounded-[26px] border border-line/80 bg-surface p-7 shadow-[var(--shadow-soft)] sm:p-12" aria-labelledby="pos-label">
        {queued ? (
          <>
            <div className="grid gap-8 sm:grid-cols-[1fr_auto] sm:items-end">
              <div>
                <div className="eyebrow" id="pos-label">
                  Your position
                </div>
                <div className="serif num mt-2 text-[clamp(6rem,20vw,10rem)] font-semibold leading-[0.8]" aria-live="polite">
                  {fmtNum(queued.position)}
                </div>
              </div>
              <div className="sm:text-right">
                <div className="eyebrow">Estimated wait</div>
                <div className="serif mt-2 text-3xl font-semibold">{wait}</div>
              </div>
            </div>
            <ProgressBar className="mt-10" value={queued.position > 1 ? admitted / (queued.position - 1) : 1} label="Progress toward your turn" />
            <div className="mt-3 flex flex-wrap justify-between gap-2 text-sm text-muted">
              <span>
                <span className="num font-bold text-fg">{fmtNum(ahead)}</span> people ahead of you
              </span>
              <span>
                <span className="num font-bold text-fg">{fmtNum(event.seats_total)}</span> seats in this drop
              </span>
            </div>
            {stalled && admitting && <p className="mt-5 text-sm text-muted">Admission is paused. Your place is held.</p>}
            <p className="serif mt-8 border-t border-line pt-6 text-[17px] italic text-muted">
              Drawn at random when registration closed. Refreshing, new tabs or reconnecting can&apos;t move you.
            </p>
          </>
        ) : (
          <div className="py-4 text-center">
            <div className="eyebrow" id="pos-label">
              Your entry
            </div>
            <div className="num mt-3 text-xl font-semibold">{me.status === "REGISTERED" ? me.entry_id : ""}</div>
            <div className="mt-8">
              <LoadingDots>{event.phase === "REGISTRATION_OPEN" ? "Waiting for registration to close" : "Drawing positions"}</LoadingDots>
            </div>
          </div>
        )}
      </section>

      <dl className="mx-auto mt-5 grid max-w-3xl grid-cols-3 overflow-hidden rounded-[20px] border border-line/80 bg-surface/70">
        {[
          [admitting ? (stalled ? "Paused" : "Active") : phase.short, "Queue status"],
          [fmtNum(inQueue), "Still in queue"],
          [queued && eta ? approx(eta) : "—", "Estimated wait"],
        ].map(([v, l], i) => (
          <div key={l} className={cx("px-4 py-5 sm:px-7", i > 0 && "border-l border-line")}>
            <dd className="serif num text-xl font-semibold leading-snug sm:text-2xl">{v}</dd>
            <dt className="mt-1 text-xs text-muted sm:text-[13px]">{l}</dt>
          </div>
        ))}
      </dl>
    </PageShell>
  );
}
