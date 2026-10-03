"use client";

import Link from "next/link";
import type { EventInfo, Me, Phase } from "@/lib/contracts";
import { eventPath, pathFor } from "@/lib/state/journey";
import { useJourney } from "@/lib/state/JourneyProvider";
import { ART_LABEL, EventArt } from "@/components/illustrations";
import { BackLink, LoadState, PageShell } from "@/components/site/chrome";
import { fmtDateLong, fmtNum, fmtPrice, fmtTime, PHASE_COPY, seatsLeft } from "@/components/site/format";
import { buttonClass, cx, ProgressBar, Skeleton, StatusBadge } from "@/components/ui";

const TIMELINE: { phases: Phase[]; title: string; subtitle: string; body: string }[] = [
  {
    phases: ["REGISTRATION_OPEN"],
    title: "Registration",
    subtitle: "Open Pool",
    body: "Join the drop pool while registration is open. The exact second you join gives zero advantage.",
  },
  {
    phases: ["REGISTRATION_CLOSED"],
    title: "The Draw",
    subtitle: "Cryptographic Shuffle",
    body: "The pool locks on the server. Every entry is shuffled using a secure, unpredictable random seed.",
  },
  {
    phases: ["QUEUE_READY", "ADMITTING"],
    title: "Admission",
    subtitle: "Batch Calibration",
    body: "Entrants are admitted in small queue batches with a 5-minute checkout window per participant.",
  },
  {
    phases: ["SOLD_OUT", "ENDED"],
    title: "Allocation",
    subtitle: "Final Settlement",
    body: "All seats are securely allocated and verified. Stubs are written to attendee ticket dashboards.",
  },
];

function Cta({ me, event, eventId }: { me?: Me; event: EventInfo; eventId: string }) {
  const primaryBtn = cx(buttonClass("primary", "lg"), "w-full shadow-lg shadow-emerald-900/15");
  if (!me) return <Skeleton className="h-13 w-full rounded-full" />;

  if (me.status !== "NOT_REGISTERED") {
    const label: Partial<Record<Me["status"], string>> = {
      REGISTERED: "View my entry",
      QUEUED: "View my place in line",
      ADMITTED: "It's your turn: reserve now",
      CONFIRMED: "View my ticket",
    };
    return (
      <Link href={pathFor(eventId, me)} className={primaryBtn}>
        {label[me.status] ?? "View my status"} <span aria-hidden>→</span>
      </Link>
    );
  }

  if (event.phase === "REGISTRATION_OPEN") {
    return (
      <Link href={eventPath(eventId, "register")} className={primaryBtn}>
        Join the drop <span aria-hidden>→</span>
      </Link>
    );
  }

  return (
    <span
      className={cx(
        buttonClass("secondary", "lg"),
        "w-full cursor-not-allowed bg-zinc-100 text-zinc-400 border-zinc-200 shadow-none",
      )}
      aria-disabled
    >
      {event.phase === "SOLD_OUT" || event.phase === "ENDED" ? "Sold out" : "Registration closed"}
    </span>
  );
}

export default function EventDetail() {
  const { event: e, me, eventId } = useJourney();
  if (!e) return <LoadState />;

  const phase = PHASE_COPY[e.phase];
  const step = TIMELINE.findIndex((t) => t.phases.includes(e.phase));
  const isAdmitting = e.phase === "ADMITTING";

  return (
    <PageShell className="pt-8 sm:pt-12">
      {/* Top Navigation */}
      <div className="mb-6">
        <BackLink href="/events">All drops</BackLink>
      </div>

      {/* Two-Column Split Layout */}
      <div className="grid gap-10 lg:grid-cols-[1.5fr_1fr] lg:gap-14 items-start">
        {/* Left Column: Event Artwork, Narrative, Guarantees & Schedule */}
        <div className="min-w-0 space-y-12">
          {/* Hero Artwork with Category & Status Overlays */}
          <div className="relative overflow-hidden rounded-[32px] border border-zinc-200/80 bg-zinc-100 shadow-sm">
            <EventArt category={e.category} className="aspect-[16/10] w-full object-cover" />
            <div className="absolute inset-0 bg-gradient-to-t from-zinc-950/70 via-transparent to-transparent pointer-events-none" />

            <div className="absolute left-5 top-5 flex flex-wrap items-center gap-2">
              <span className="glass-panel rounded-full px-3.5 py-1 text-xs font-semibold uppercase tracking-wider text-zinc-800 shadow-sm border border-white/60">
                {ART_LABEL[e.category]}
              </span>
              <StatusBadge tone={phase.tone} className="glass-panel shadow-sm border-white/60">
                {phase.label}
              </StatusBadge>
            </div>

            <div className="absolute bottom-5 left-5 right-5 flex items-baseline justify-between text-white">
              <span className="text-sm font-light text-zinc-200">
                {e.venue} · {e.city}
              </span>
              <span className="text-sm font-semibold uppercase tracking-wider text-emerald-400">
                {fmtPrice(e.price_inr)}
              </span>
            </div>
          </div>

          {/* Title & Description Header */}
          <div>
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-emerald-600">
              <span>Organized by {e.organizer}</span>
            </div>
            <h1 className="mt-3 text-3xl font-extrabold tracking-tight text-zinc-900 sm:text-5xl lg:text-6xl leading-[1.08]">
              {e.name}
            </h1>
            <p className="mt-3 text-xl font-light italic text-zinc-600 sm:text-2xl">
              {e.tagline}
            </p>
            <p className="mt-6 text-base font-light leading-relaxed text-zinc-700 sm:text-lg">
              {e.description}
            </p>
          </div>

          {/* Event Schedule & Venue Information */}
          <div className="rounded-3xl border border-zinc-200/80 bg-white p-7 shadow-sm space-y-6">
            <h2 className="text-xl font-bold text-zinc-900">Event Schedule &amp; Details</h2>
            <div className="grid gap-6 sm:grid-cols-2 text-sm">
              <div className="space-y-1 rounded-2xl bg-zinc-50 p-4 border border-zinc-100">
                <span className="text-xs font-semibold uppercase tracking-wider text-zinc-500">Date</span>
                <p className="text-base font-semibold text-zinc-900">{fmtDateLong(e.starts_at)}</p>
              </div>
              <div className="space-y-1 rounded-2xl bg-zinc-50 p-4 border border-zinc-100">
                <span className="text-xs font-semibold uppercase tracking-wider text-zinc-500">Timing</span>
                <p className="text-base font-semibold text-zinc-900">
                  {fmtTime(e.starts_at)} – {fmtTime(e.ends_at)} IST
                </p>
              </div>
              <div className="space-y-1 rounded-2xl bg-zinc-50 p-4 border border-zinc-100">
                <span className="text-xs font-semibold uppercase tracking-wider text-zinc-500">Venue</span>
                <p className="text-base font-semibold text-zinc-900">{e.venue}</p>
                <p className="text-xs text-zinc-500 font-light">{e.city}</p>
              </div>
              <div className="space-y-1 rounded-2xl bg-zinc-50 p-4 border border-zinc-100">
                <span className="text-xs font-semibold uppercase tracking-wider text-zinc-500">Organizer</span>
                <p className="text-base font-semibold text-zinc-900">{e.organizer}</p>
                <p className="text-xs text-emerald-600 font-medium">Verified Partner</p>
              </div>
            </div>
          </div>

          {/* Drop Timeline */}
          <section aria-labelledby="timeline-heading" className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 id="timeline-heading" className="text-xl font-bold text-zinc-900">
                How this drop runs
              </h2>
              <span className="text-xs font-medium text-emerald-600 uppercase tracking-wider">
                Phase {Math.max(1, step + 1)} of {TIMELINE.length}
              </span>
            </div>

            <ol className="grid gap-4 sm:grid-cols-2">
              {TIMELINE.map((t, i) => {
                const isActive = i === step;
                const isPast = i < step;
                return (
                  <li
                    key={t.title}
                    aria-current={isActive ? "step" : undefined}
                    className={cx(
                      "rounded-2xl border p-5 transition-all duration-200",
                      isActive
                        ? "border-emerald-500/60 bg-emerald-50/30 shadow-md shadow-emerald-950/5 ring-1 ring-emerald-500/20"
                        : "border-zinc-200/80 bg-white shadow-sm",
                      isPast && "opacity-75 bg-zinc-50/60",
                    )}
                  >
                    <div className="flex items-center justify-between">
                      <span
                        className={cx(
                          "grid size-7 place-items-center rounded-full text-xs font-bold",
                          isPast
                            ? "bg-emerald-100 text-emerald-700"
                            : isActive
                              ? "bg-emerald-600 text-white shadow-sm"
                              : "bg-zinc-100 text-zinc-500",
                        )}
                      >
                        {isPast ? "✓" : i + 1}
                      </span>
                      {isActive && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-emerald-800">
                          <span className="size-1.5 rounded-full bg-emerald-600 pulse-dot" />
                          Current
                        </span>
                      )}
                    </div>
                    <div className="mt-3 text-base font-bold text-zinc-900">{t.title}</div>
                    <div className="text-xs font-semibold uppercase tracking-wider text-emerald-600">{t.subtitle}</div>
                    <p className="mt-2 text-xs font-light leading-relaxed text-zinc-600">{t.body}</p>
                  </li>
                );
              })}
            </ol>
          </section>

          {/* Anti-Bot Fairness Guarantees */}
          <div className="rounded-3xl border border-zinc-200/80 bg-zinc-900 text-white p-7 shadow-lg space-y-5 relative overflow-hidden">
            <div className="pointer-events-none absolute -top-20 -right-20 size-60 rounded-full bg-emerald-500/10 blur-3xl" />
            <div className="relative">
              <span className="text-xs font-semibold uppercase tracking-wider text-emerald-400">Fairness Architecture</span>
              <h3 className="mt-1 text-xl font-bold text-white">Bot Protection &amp; Queue Rules</h3>
              <p className="mt-2 text-xs text-zinc-300 font-light leading-relaxed">
                Every ticket sold on Fair Drop is defended by our multi-layer bot mitigation engine.
              </p>
            </div>
            <div className="relative grid gap-4 sm:grid-cols-2 text-xs font-light text-zinc-300 pt-2">
              <div className="flex items-start gap-3">
                <span className="grid size-5 shrink-0 place-items-center rounded-full bg-emerald-500/20 text-emerald-400 font-bold text-[10px]">✓</span>
                <div>
                  <strong className="text-white font-medium">1 Person = 1 Seat:</strong> Strictly one ticket allocation per verified human profile.
                </div>
              </div>
              <div className="flex items-start gap-3">
                <span className="grid size-5 shrink-0 place-items-center rounded-full bg-emerald-500/20 text-emerald-400 font-bold text-[10px]">✓</span>
                <div>
                  <strong className="text-white font-medium">5-Minute Window:</strong> Once admitted, your seat is reserved for 300 seconds.
                </div>
              </div>
              <div className="flex items-start gap-3">
                <span className="grid size-5 shrink-0 place-items-center rounded-full bg-emerald-500/20 text-emerald-400 font-bold text-[10px]">✓</span>
                <div>
                  <strong className="text-white font-medium">Zero Speed Edge:</strong> Register early or late in the pool — lottery odds are identical.
                </div>
              </div>
              <div className="flex items-start gap-3">
                <span className="grid size-5 shrink-0 place-items-center rounded-full bg-emerald-500/20 text-emerald-400 font-bold text-[10px]">✓</span>
                <div>
                  <strong className="text-white font-medium">Tamper-Proof Seeds:</strong> Cryptographic shuffle seed is audited and immutable.
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Sticky Booking Glass Card */}
        <aside className="lg:pt-2">
          <div className="sticky top-28 rounded-3xl border border-zinc-200/80 glass-panel p-7 shadow-xl shadow-zinc-900/5 backdrop-blur-xl">
            {/* Price Header */}
            <div className="flex items-baseline justify-between">
              <div>
                <span className="text-3xl sm:text-4xl font-extrabold tracking-tight text-zinc-900">
                  {fmtPrice(e.price_inr)}
                </span>
                <span className="ml-2 text-xs text-zinc-500 font-light">INR</span>
              </div>
              <span className="rounded-full bg-zinc-100 px-3 py-1 text-xs font-medium text-zinc-600">
                1 per person
              </span>
            </div>

            {/* Capacity & Allocation Meters */}
            <div className="mt-7 space-y-3 border-t border-zinc-200/70 pt-6">
              <div className="flex justify-between text-xs text-zinc-600">
                <span>Seats confirmed</span>
                <span className="num font-semibold text-zinc-900">
                  {fmtNum(e.seats_confirmed)} / {fmtNum(e.seats_total)}
                </span>
              </div>
              <ProgressBar
                value={e.seats_confirmed / e.seats_total}
                label="Seats confirmed"
                tone="success"
                className="h-2.5"
              />
              <div className="flex justify-between text-xs font-light text-zinc-500">
                <span>
                  <strong className="font-semibold text-zinc-800">{fmtNum(seatsLeft(e))}</strong> remaining
                </span>
                {isAdmitting && (
                  <span className="font-medium text-emerald-600 flex items-center gap-1">
                    <span className="size-1.5 rounded-full bg-emerald-500 pulse-dot" />
                    Live admission active
                  </span>
                )}
              </div>
            </div>

            {/* Key Event Attributes */}
            <dl className="mt-6 space-y-3.5 border-t border-zinc-200/70 pt-6 text-sm">
              <div className="flex justify-between gap-4">
                <dt className="text-zinc-500 font-light">Status</dt>
                <dd>
                  <StatusBadge tone={phase.tone}>{phase.label}</StatusBadge>
                </dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-zinc-500 font-light">In the pool</dt>
                <dd className="num font-semibold text-zinc-900">{fmtNum(e.registrations)} verified</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-zinc-500 font-light">Date</dt>
                <dd className="font-medium text-zinc-900 text-right">{fmtDateLong(e.starts_at)}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-zinc-500 font-light">Time</dt>
                <dd className="font-medium text-zinc-900">{fmtTime(e.starts_at)} IST</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-zinc-500 font-light">Checkout window</dt>
                <dd className="font-medium text-emerald-600">5 minutes</dd>
              </div>
            </dl>

            {/* Dynamic CTA */}
            <div className="mt-8">
              <Cta me={me} event={e} eventId={eventId} />
            </div>

            {/* Phase Explanatory Note */}
            <p className="mt-4 text-center text-xs font-light leading-relaxed text-zinc-500">
              {phase.line}
            </p>
          </div>
        </aside>
      </div>
    </PageShell>
  );
}
