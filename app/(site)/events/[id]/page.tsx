"use client";

import Link from "next/link";
import type { EventInfo, Me, Phase } from "@/lib/contracts";
import { eventPath, pathFor } from "@/lib/state/journey";
import { useJourney } from "@/lib/state/JourneyProvider";
import { ART_LABEL, EventArt } from "@/components/illustrations";
import { BackLink, LoadState, PageShell } from "@/components/site/chrome";
import { fmtDateLong, fmtNum, fmtPrice, fmtTime, PHASE_COPY, seatsLeft } from "@/components/site/format";
import { buttonClass, cx, ProgressBar, Skeleton, StatusBadge } from "@/components/ui";

const TIMELINE: { phases: Phase[]; title: string; body: string }[] = [
  { phases: ["REGISTRATION_OPEN"], title: "Registration", body: "Join the pool. Order of joining doesn't matter." },
  { phases: ["REGISTRATION_CLOSED"], title: "The draw", body: "List freezes, every entry gets a random position." },
  { phases: ["QUEUE_READY", "ADMITTING"], title: "Admission", body: "Small batches, five minutes each to confirm." },
  { phases: ["SOLD_OUT", "ENDED"], title: "Allocated", body: "Every seat confirmed and audited." },
];

function Cta({ me, event, eventId }: { me?: Me; event: EventInfo; eventId: string }) {
  const lg = cx(buttonClass("primary", "lg"), "w-full");
  if (!me) return <Skeleton className="h-14 w-full rounded-full" />;
  if (me.status !== "NOT_REGISTERED") {
    const label: Partial<Record<Me["status"], string>> = {
      REGISTERED: "View my entry",
      QUEUED: "View my place in line",
      ADMITTED: "It's your turn: reserve now",
      CONFIRMED: "View my ticket",
    };
    return (
      <Link href={pathFor(eventId, me)} className={lg}>
        {label[me.status] ?? "View my status"} <span aria-hidden>→</span>
      </Link>
    );
  }
  if (event.phase === "REGISTRATION_OPEN")
    return (
      <Link href={eventPath(eventId, "register")} className={lg}>
        Join the drop <span aria-hidden>→</span>
      </Link>
    );
  return (
    <span className={cx(buttonClass("secondary", "lg"), "w-full cursor-default hover:border-line")} aria-disabled>
      {event.phase === "SOLD_OUT" || event.phase === "ENDED" ? "Sold out" : "Registration closed"}
    </span>
  );
}

export default function EventDetail() {
  const { event: e, me, eventId } = useJourney();
  if (!e) return <LoadState />;
  const phase = PHASE_COPY[e.phase];
  const step = TIMELINE.findIndex((t) => t.phases.includes(e.phase));

  return (
    <PageShell className="pt-8 sm:pt-10">
      <BackLink href="/events">All events</BackLink>

      <div className="mt-6 grid gap-10 lg:grid-cols-[1.55fr_1fr] lg:gap-14">
        <div className="min-w-0">
          <div className="overflow-hidden rounded-[26px] border border-line/80 bg-bg-2 shadow-[var(--shadow-soft)]">
            <EventArt category={e.category} className="aspect-[3/2] w-full" />
          </div>

          <div className="mt-10 flex flex-wrap items-center gap-3">
            <span className="rounded-full bg-bg-2 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.14em] text-muted">{ART_LABEL[e.category]}</span>
            <StatusBadge tone={phase.tone}>{phase.label}</StatusBadge>
          </div>
          <h1 className="display mt-5 text-[clamp(2.8rem,6vw,4.8rem)]">{e.name}</h1>
          <p className="serif mt-3 text-2xl italic text-muted">{e.tagline}</p>
          <p className="mt-8 max-w-2xl text-[17px] leading-relaxed text-fg/85">{e.description}</p>

          <section className="mt-14" aria-labelledby="tl">
            <h2 id="tl" className="serif text-3xl font-semibold">
              How this drop runs
            </h2>
            <ol className="mt-8 grid gap-4 sm:grid-cols-4">
              {TIMELINE.map((t, i) => (
                <li
                  key={t.title}
                  aria-current={i === step ? "step" : undefined}
                  className={cx(
                    "rounded-[18px] border p-5",
                    i === step ? "border-accent/40 bg-surface shadow-[var(--shadow-soft)]" : "border-line bg-surface/50",
                    i < step && "opacity-70",
                  )}
                >
                  <div className="flex items-center gap-2">
                    <span
                      className={cx(
                        "grid size-6 place-items-center rounded-full text-[11px] font-bold",
                        i < step ? "bg-success-soft text-success" : i === step ? "bg-accent text-white" : "bg-bg-2 text-muted",
                      )}
                    >
                      {i < step ? "✓" : i + 1}
                    </span>
                    {i === step && <span className="text-[11px] font-bold uppercase tracking-[0.14em] text-accent">Now</span>}
                  </div>
                  <div className="serif mt-3 text-xl font-semibold">{t.title}</div>
                  <p className="mt-1 text-sm leading-relaxed text-muted">{t.body}</p>
                </li>
              ))}
            </ol>
          </section>
        </div>

        <aside className="lg:pt-2">
          <div className="sticky top-24 rounded-[24px] border border-line/80 bg-surface p-7 shadow-[var(--shadow-soft)]">
            <div className="flex items-baseline justify-between">
              <span className="serif text-4xl font-semibold">{fmtPrice(e.price_inr)}</span>
              <span className="text-sm text-muted">per seat · 1 per person</span>
            </div>
            <dl className="mt-7 space-y-4 border-t border-line pt-6 text-[15px]">
              <Row k="Date" v={fmtDateLong(e.starts_at)} />
              <Row k="Time" v={`${fmtTime(e.starts_at)} – ${fmtTime(e.ends_at)} IST`} />
              <Row k="Venue" v={`${e.venue}, ${e.city}`} />
              <Row k="Organizer" v={e.organizer} />
              <Row k="In the pool" v={fmtNum(e.registrations)} />
            </dl>
            <div className="mt-6">
              <div className="flex justify-between text-sm">
                <span className="text-muted">Seats confirmed</span>
                <span className="num font-semibold">
                  {fmtNum(e.seats_confirmed)} / {fmtNum(e.seats_total)}
                </span>
              </div>
              <ProgressBar className="mt-2" value={e.seats_confirmed / e.seats_total} label="Seats confirmed" />
              {e.phase === "ADMITTING" && <p className="mt-2 text-[13px] text-muted">{fmtNum(seatsLeft(e))} still to allocate</p>}
            </div>
            <div className="mt-7">
              <Cta me={me} event={e} eventId={eventId} />
            </div>
            <p className="mt-4 text-center text-[13px] leading-relaxed text-muted">{phase.line}</p>
          </div>
        </aside>
      </div>
    </PageShell>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex justify-between gap-6">
      <dt className="text-muted">{k}</dt>
      <dd className="text-right font-semibold">{v}</dd>
    </div>
  );
}
