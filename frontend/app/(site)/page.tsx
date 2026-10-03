"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { GateArt, HeroArt } from "@/components/illustrations";
import { PAD, WRAP } from "@/components/site/chrome";
import { EventCard, EventCardSkeleton } from "@/components/site/EventCard";
import { fmtNum, fmtPrice, PHASE_ORDER, seatsLeft } from "@/components/site/format";
import { useEvents } from "@/components/site/useEvents";
import { buttonClass, cx, ProgressBar } from "@/components/ui";
import { eventPath } from "@/lib/state/journey";

const PHRASES = [
  "one person, one entry",
  "no head start",
  "order drawn at random",
  "refresh all you like",
  "bots get zero advantage",
  "five minutes to confirm",
];

const STEPS = [
  {
    num: "01",
    title: "Register",
    subtitle: "Verified human check",
    body: "Sign in with Google and pass a lightweight Cloudflare Turnstile check while registration is open. When you join within the window gives zero advantage.",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="size-6 text-emerald-600">
        <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="M22 11l-3 3-2-2" />
      </svg>
    ),
  },
  {
    num: "02",
    title: "Freeze",
    subtitle: "List locks instantly",
    body: "Registration closes and the list freezes on the server. Refreshes, reconnects, multiple tabs, and parallel scraper threads cannot alter or duplicate your entry.",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="size-6 text-emerald-600">
        <rect width="18" height="11" x="3" y="11" rx="2" ry="2" />
        <path d="M7 11V7a5 5 0 0 1 10 0v4" />
      </svg>
    ),
  },
  {
    num: "03",
    title: "Draw",
    subtitle: "Cryptographic shuffle",
    body: "The server shuffles all verified entries once with a high-entropy cryptographically secure random seed. Your queue position is tamper-proof and final.",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="size-6 text-emerald-600">
        <path d="M2 18h1.4c1.3 0 2.5-.6 3.3-1.7l6.1-8.6c.8-1.1 2-1.7 3.3-1.7H22" />
        <path d="m18 2 4 4-4 4" />
        <path d="M2 6h1.9c1.5 0 2.9.9 3.6 2.2" />
        <path d="M22 18h-5.9c-1.3 0-2.5-.7-3.3-1.8l-.5-.7" />
        <path d="m18 14 4 4-4 4" />
      </svg>
    ),
  },
  {
    num: "04",
    title: "Your turn",
    subtitle: "5-minute confirmation",
    body: "Seats unlock in small, controlled batches. When your number is called, you get a dedicated 5-minute reservation window to confirm your ticket with zero rush.",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="size-6 text-emerald-600">
        <circle cx="12" cy="12" r="10" />
        <polyline points="12 6 12 12 16 14" />
      </svg>
    ),
  },
];

const DEFENSE_PILLARS = [
  {
    title: "Cloudflare Turnstile",
    tag: "Bot Wall",
    description: "Zero-friction human verification that blocks headless scrapers, emulators, and credential stuffers before registration ever opens.",
  },
  {
    title: "Cryptographic Shuffle",
    tag: "Entropy Seed",
    description: "Fisher-Yates random permutation generated server-side using cryptographically secure random seeds. Impossible to predict or manipulate.",
  },
  {
    title: "Identity Deduplication",
    tag: "1 Person = 1 Entry",
    description: "Strict single-entry enforcement tied to verified accounts. Sybil attacks, disposable burner accounts, and bot farms get filtered automatically.",
  },
  {
    title: "Zero Latency Advantage",
    tag: "Equal Footing",
    description: "Network distance, fiber connections, and sub-millisecond bot scripts gain zero edge over an ordinary mobile connection.",
  },
];

const FAQ = [
  {
    q: "Does registering early help me get a better position?",
    a: "No. Every registration is gathered into a pool during the open window. When the drop locks, the server generates a cryptographic random shuffle. The first person to join and the last person have the exact same probability.",
  },
  {
    q: "Can I refresh or open multiple browser tabs?",
    a: "Yes, but it won't change anything. Your entry, verification status, and queue position are safely stored and tracked on the server. Opening more tabs simply displays the exact same state.",
  },
  {
    q: "What prevents scalpers and bot farms from taking all tickets?",
    a: "Fair Drop combines Cloudflare Turnstile human checks, verified Google identity deduplication, server-side rate limits, and randomized queue shuffling. Automated scripts cannot jump ahead in line.",
  },
  {
    q: "What happens if I miss my 5-minute confirmation window?",
    a: "If you don't complete confirmation before the timer expires, the reservation is released and immediately offered to the next person in line. Each person receives one turn per drop.",
  },
  {
    q: "Can I enter drops for multiple events at the same time?",
    a: "Yes! Each event operates its own independent drop pool and queue. Joining one drop never impacts your chances or queue position in another.",
  },
  {
    q: "How are tickets delivered once confirmed?",
    a: "Once confirmed, your ticket stub is cryptographically registered to your account and instantly available under 'My Tickets' with your unique seat assignment and QR code.",
  },
];

function Denied() {
  const p = useSearchParams();
  if (p.get("denied") !== "admin") return null;
  return (
    <div className="mx-auto mb-6 flex w-fit items-center gap-2 rounded-full border border-red-200 bg-red-50 px-4 py-2 text-sm font-medium text-red-700 shadow-sm">
      <span className="size-2 rounded-full bg-red-500" />
      The admin portal requires administrator credentials.
    </div>
  );
}

export default function Home() {
  const { data: events } = useEvents();
  const sorted = events ? [...events].sort((a, b) => PHASE_ORDER[a.phase] - PHASE_ORDER[b.phase]) : undefined;
  const live = sorted?.find((e) => e.phase === "ADMITTING");
  const upcoming = sorted?.filter((e) => e.phase === "REGISTRATION_OPEN" || e.phase === "QUEUE_READY");

  const [activeFaq, setActiveFaq] = useState<number | null>(null);

  return (
    <main className="flex-1 overflow-x-hidden">
      {/* Hero Section */}
      <section className="relative pt-28 pb-20 sm:pt-36 sm:pb-28">
        {/* Ambient atmospheric glow */}
        <div className="pointer-events-none absolute -top-20 left-1/2 -translate-x-1/2 size-[650px] rounded-full bg-emerald-500/10 blur-[130px]" aria-hidden />

        <div className={cx(WRAP, PAD, "relative")}>
          <Suspense>
            <Denied />
          </Suspense>

          <div className="grid items-center gap-12 lg:grid-cols-[1.1fr_1fr] lg:gap-16">
            <div className="rise">
              <div className="inline-flex items-center gap-2.5 rounded-full border border-emerald-200/80 bg-emerald-50/90 px-4 py-1.5 text-xs font-semibold uppercase tracking-wider text-emerald-800 shadow-sm">
                <span className="size-2 rounded-full bg-emerald-600 pulse-dot" aria-hidden />
                Anti-Bot Fairness Engine · 100% Shuffled
              </div>

              <h1 className="mt-7 text-4xl font-extrabold tracking-tight text-zinc-900 sm:text-6xl lg:text-7xl leading-[1.08]">
                Tickets without <br />
                <span className="text-emerald-600">the race.</span>
              </h1>

              <p className="mt-6 max-w-xl text-lg font-light leading-relaxed text-zinc-600 sm:text-xl">
                Stop the bots. Protect the seats. One entry per verified person, randomized queue shuffling, and zero reward for refreshing or running automation scripts.
              </p>

              <div className="mt-9 flex flex-wrap items-center gap-3.5">
                <Link href="/events" className={buttonClass("primary", "lg")}>
                  Browse drops <span aria-hidden className="transition-transform group-hover:translate-x-1">→</span>
                </Link>
                <Link
                  href="/#how"
                  className={cx(
                    buttonClass("secondary", "lg"),
                    "glass-panel border-zinc-200/80 hover:bg-zinc-100/70 shadow-sm",
                  )}
                >
                  How it works
                </Link>
              </div>

              {/* Trust signals */}
              <div className="mt-10 flex flex-wrap items-center gap-6 border-t border-zinc-200/70 pt-8 text-xs font-light text-zinc-500">
                <div className="flex items-center gap-2">
                  <svg viewBox="0 0 20 20" fill="currentColor" className="size-4 text-emerald-600" aria-hidden>
                    <path fillRule="evenodd" d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z" clipRule="evenodd" />
                  </svg>
                  <span>1 Verified Ticket / Attendee</span>
                </div>
                <div className="flex items-center gap-2">
                  <svg viewBox="0 0 20 20" fill="currentColor" className="size-4 text-emerald-600" aria-hidden>
                    <path fillRule="evenodd" d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z" clipRule="evenodd" />
                  </svg>
                  <span>Cloudflare Turnstile Protected</span>
                </div>
                <div className="flex items-center gap-2">
                  <svg viewBox="0 0 20 20" fill="currentColor" className="size-4 text-emerald-600" aria-hidden>
                    <path fillRule="evenodd" d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z" clipRule="evenodd" />
                  </svg>
                  <span>0 ms Speed Advantage</span>
                </div>
              </div>
            </div>

            {/* Hero Interactive Art with Floating Glass Cards */}
            <div className="relative mx-auto w-full max-w-[560px]">
              <div className="overflow-hidden rounded-[36px] border border-zinc-200/80 bg-white p-3 shadow-2xl shadow-emerald-950/5">
                <HeroArt className="w-full overflow-hidden rounded-[28px]" />
              </div>

              {/* Floating Glass Card 1: Live Admission Drop */}
              {live ? (
                <Link
                  href={eventPath(live.id)}
                  className="float absolute -top-4 -left-3 sm:-left-6 w-64 rounded-2xl border border-zinc-200/80 glass-panel p-4 shadow-xl shadow-zinc-900/5 transition-all hover:border-emerald-500/50 hover:shadow-2xl"
                >
                  <div className="flex items-center justify-between text-[11px] font-semibold uppercase tracking-wider text-emerald-600">
                    <span className="flex items-center gap-1.5">
                      <span className="size-2 rounded-full bg-emerald-500 pulse-dot" aria-hidden />
                      Live Drop
                    </span>
                    <span className="text-[10px] font-medium text-zinc-500">{live.city}</span>
                  </div>
                  <div className="mt-1.5 text-base font-semibold text-zinc-900 truncate">{live.name}</div>
                  <div className="mt-2 space-y-1.5">
                    <ProgressBar value={live.seats_confirmed / live.seats_total} label="Seats filled" tone="success" className="h-1.5" />
                    <div className="flex justify-between text-[11px] text-zinc-500 font-light">
                      <span><strong className="num text-zinc-800 font-semibold">{fmtNum(seatsLeft(live))}</strong> seats left</span>
                      <span className="text-emerald-700 font-medium">Batch admitting</span>
                    </div>
                  </div>
                </Link>
              ) : (
                <div className="float absolute -top-4 -left-3 sm:-left-6 w-64 rounded-2xl border border-zinc-200/80 glass-panel p-4 shadow-xl shadow-zinc-900/5">
                  <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-emerald-600">
                    <span className="size-2 rounded-full bg-emerald-500 pulse-dot" aria-hidden />
                    Upcoming Drop
                  </div>
                  <div className="mt-1 text-base font-semibold text-zinc-900">Bit N Build 2026</div>
                  <div className="mt-1 text-xs text-zinc-500 font-light">Fair allocation queue standing by</div>
                </div>
              )}

              {/* Floating Glass Card 2: Tamper-proof Position */}
              <div className="float absolute -bottom-5 -right-3 sm:-right-5 w-56 rounded-2xl border border-zinc-200/80 glass-panel p-4 shadow-xl shadow-zinc-900/5 [animation-delay:-2.5s]">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="font-semibold uppercase tracking-wider text-zinc-500">Queue Position</span>
                  <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold text-emerald-800">
                    Turnstile ✓
                  </span>
                </div>
                <div className="num mt-2 text-3xl font-extrabold tracking-tight text-zinc-900">#142</div>
                <div className="mt-1 flex items-center gap-1.5 text-xs text-zinc-500 font-light">
                  <span className="size-1.5 rounded-full bg-emerald-500" />
                  <span>Drawn at random &amp; locked</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Marquee Ticker */}
      <section className="overflow-hidden border-y border-zinc-200/70 bg-zinc-100/60 py-4.5" aria-label="Core Principles">
        <div className="marquee flex w-max gap-10 whitespace-nowrap">
          {[...PHRASES, ...PHRASES, ...PHRASES, ...PHRASES].map((p, i) => (
            <span key={i} className="flex items-center gap-10 text-xl font-light italic tracking-tight text-zinc-700 sm:text-2xl">
              {p}
              <span className="size-2 rounded-full bg-emerald-500" aria-hidden />
            </span>
          ))}
        </div>
      </section>

      {/* Live Drops Showcase */}
      <section className={cx(WRAP, PAD, "py-20 sm:py-28")}>
        <div className="flex flex-wrap items-end justify-between gap-6">
          <div>
            <div className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-emerald-600">
              <span className="size-1.5 rounded-full bg-emerald-500 pulse-dot" aria-hidden />
              On The Calendar
            </div>
            <h2 className="mt-3 text-3xl font-extrabold tracking-tight text-zinc-900 sm:text-5xl">
              Live &amp; upcoming <span className="text-emerald-600">drops</span>
            </h2>
            <p className="mt-3 text-base text-zinc-500 font-light max-w-xl">
              Discover verified drops currently accepting registrations or live in admission.
            </p>
          </div>
          <Link
            href="/events"
            className="group inline-flex items-center gap-2 text-sm font-semibold text-emerald-600 hover:text-emerald-700 transition-colors"
          >
            View all drops
            <span aria-hidden className="transition-transform group-hover:translate-x-1">→</span>
          </Link>
        </div>

        {/* Live Highlight Banner if an event is currently admitting */}
        {live && (
          <div className="mt-10 overflow-hidden rounded-3xl border border-emerald-300/80 bg-gradient-to-r from-emerald-500/10 via-emerald-500/5 to-transparent p-6 sm:p-8 backdrop-blur-sm">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
              <div className="space-y-2">
                <div className="inline-flex items-center gap-2 rounded-full bg-emerald-600 px-3 py-1 text-xs font-semibold text-white shadow-sm">
                  <span className="size-2 rounded-full bg-white pulse-dot" />
                  ADMISSION BATCH IN PROGRESS
                </div>
                <h3 className="text-2xl font-bold text-zinc-900 sm:text-3xl">{live.name}</h3>
                <p className="text-sm text-zinc-600 font-light max-w-2xl">{live.tagline}</p>
              </div>

              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-6 lg:border-l lg:border-zinc-200 lg:pl-8">
                <div className="space-y-1.5 min-w-[200px]">
                  <div className="flex justify-between text-xs text-zinc-600">
                    <span>Remaining capacity</span>
                    <span className="font-semibold text-zinc-900">{fmtNum(seatsLeft(live))} / {fmtNum(live.seats_total)}</span>
                  </div>
                  <ProgressBar value={live.seats_confirmed / live.seats_total} label="Seats allocation" tone="success" className="h-2.5" />
                  <div className="text-[11px] text-zinc-500 font-light">{fmtPrice(live.price_inr)} · {live.city}</div>
                </div>

                <Link
                  href={eventPath(live.id)}
                  className={cx(buttonClass("primary", "md"), "shrink-0 shadow-lg shadow-emerald-900/15")}
                >
                  Enter live drop →
                </Link>
              </div>
            </div>
          </div>
        )}

        {/* Grid of drops */}
        <div className="mt-10 grid gap-7 sm:grid-cols-2 lg:grid-cols-3">
          {sorted ? (
            sorted.slice(0, 6).map((e) => <EventCard key={e.id} event={e} />)
          ) : (
            Array.from({ length: 3 }, (_, i) => <EventCardSkeleton key={i} />)
          )}
        </div>
      </section>

      {/* Section: How It Works (2-column layout inspired by Le Lieu) */}
      <section id="how" className="scroll-mt-24 border-y border-zinc-200/70 bg-zinc-50/70 py-24 sm:py-32">
        <div className={cx(WRAP, PAD)}>
          <div className="grid gap-16 lg:grid-cols-[1fr_1.2fr] lg:gap-20 items-start">
            {/* Left Column: Heading and philosophy */}
            <div className="lg:sticky lg:top-28 space-y-6">
              <div className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3.5 py-1 text-xs font-semibold uppercase tracking-wider text-emerald-800">
                Architected for Fairness
              </div>
              <h2 className="text-3xl font-extrabold tracking-tight text-zinc-900 sm:text-5xl leading-tight">
                Four steps. <br />
                <span className="text-emerald-600">No shortcuts.</span>
              </h2>
              <p className="text-lg text-zinc-600 font-light leading-relaxed">
                Traditional ticketing rewards whoever has the fastest bot or nearest datacenter. Fair Drop turns high-demand drops into a verified, calm lottery where everybody has identical odds.
              </p>

              <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm space-y-4">
                <div className="text-xs font-semibold uppercase tracking-wider text-zinc-500">The Fair Drop Guarantee</div>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div className="space-y-1">
                    <div className="num text-2xl font-bold text-emerald-600">1 : 1</div>
                    <div className="text-xs text-zinc-500 font-light">Person per registered entry</div>
                  </div>
                  <div className="space-y-1">
                    <div className="num text-2xl font-bold text-emerald-600">5 min</div>
                    <div className="text-xs text-zinc-500 font-light">Guaranteed checkout window</div>
                  </div>
                </div>
              </div>

              <div className="pt-2">
                <Link href="/events" className={buttonClass("primary", "md")}>
                  Experience a drop <span aria-hidden>→</span>
                </Link>
              </div>
            </div>

            {/* Right Column: 4 Clean Steps */}
            <div className="space-y-5">
              {STEPS.map((s) => (
                <div
                  key={s.title}
                  className="group relative overflow-hidden rounded-3xl border border-zinc-200/80 bg-white p-7 shadow-sm transition-all duration-300 hover:border-emerald-500/30 hover:shadow-lg hover:shadow-emerald-950/5"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-center gap-4">
                      <div className="grid size-12 place-items-center rounded-2xl bg-emerald-50 border border-emerald-100/80 group-hover:bg-emerald-100/60 transition-colors">
                        {s.icon}
                      </div>
                      <div>
                        <div className="text-xs font-semibold uppercase tracking-wider text-emerald-600">{s.subtitle}</div>
                        <h3 className="text-xl font-bold text-zinc-900">{s.title}</h3>
                      </div>
                    </div>
                    <span className="num text-2xl font-extrabold text-zinc-200 group-hover:text-emerald-200 transition-colors">
                      {s.num}
                    </span>
                  </div>
                  <p className="mt-4 text-sm font-light leading-relaxed text-zinc-600 pl-16">
                    {s.body}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Section: Anti-Bot Defense Engine (Dark section with emerald glow) */}
      <section id="defense" className="scroll-mt-24 py-16 sm:py-24">
        <div className={cx(WRAP, PAD)}>
          <div className="relative overflow-hidden rounded-[36px] bg-zinc-900 px-6 py-16 text-white sm:px-12 sm:py-24 lg:px-16 border border-white/10 shadow-2xl">
            {/* Ambient emerald glowing orbs */}
            <div className="pointer-events-none absolute -top-24 -right-24 size-[500px] rounded-full bg-emerald-500/15 blur-[140px]" aria-hidden />
            <div className="pointer-events-none absolute -bottom-24 -left-24 size-[500px] rounded-full bg-emerald-950/40 blur-[140px]" aria-hidden />

            <div className="relative max-w-3xl">
              <span className="inline-flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3.5 py-1 text-xs font-semibold uppercase tracking-wider text-emerald-400">
                <span className="size-1.5 rounded-full bg-emerald-400 pulse-dot" />
                Zero-Trust Anti-Scalping Architecture
              </span>
              <h2 className="mt-4 text-3xl font-extrabold tracking-tight sm:text-5xl lg:text-6xl text-white">
                Engineered to make <br />
                <span className="text-emerald-400">bots powerless.</span>
              </h2>
              <p className="mt-5 text-base sm:text-lg text-zinc-300 font-light leading-relaxed">
                By separating registration from queue draw and locking entries before shuffle, Fair Drop renders sub-second scripts, automated clickers, and proxies entirely obsolete.
              </p>
            </div>

            {/* 4 Pillars Grid */}
            <div className="relative mt-14 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
              {DEFENSE_PILLARS.map((p) => (
                <div
                  key={p.title}
                  className="rounded-2xl border border-white/10 bg-white/[0.04] p-6 backdrop-blur-md transition-all duration-300 hover:border-emerald-500/40 hover:bg-white/[0.07]"
                >
                  <span className="text-[11px] font-semibold uppercase tracking-widest text-emerald-400">{p.tag}</span>
                  <h3 className="mt-2 text-lg font-bold text-white">{p.title}</h3>
                  <p className="mt-3 text-xs leading-relaxed text-zinc-400 font-light">{p.description}</p>
                </div>
              ))}
            </div>

            {/* Stat Cards with Modern Glass Borders */}
            <div className="relative mt-12 grid grid-cols-2 gap-4 border-t border-white/10 pt-10 sm:grid-cols-4 sm:gap-6">
              {[
                { val: "0 ms", label: "Latency head start", desc: "No edge for faster pings" },
                { val: "100%", label: "Cryptographic shuffle", desc: "Auditable seed randomness" },
                { val: "1 Seat", label: "Per verified entrant", desc: "Hard anti-sybil enforcement" },
                { val: "0", label: "Double allocations", desc: "Atomic server reservation lock" },
              ].map((s) => (
                <div key={s.label} className="rounded-2xl border border-white/10 bg-white/[0.03] p-5 backdrop-blur-sm">
                  <div className="num text-3xl font-extrabold text-emerald-400 sm:text-4xl">{s.val}</div>
                  <div className="mt-2 text-xs font-semibold text-white">{s.label}</div>
                  <div className="mt-1 text-[11px] text-zinc-400 font-light">{s.desc}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Section: Gate Art Illustration & Integrity */}
      <section className={cx(WRAP, PAD, "py-20 sm:py-28")}>
        <div className="grid items-center gap-12 lg:grid-cols-[1fr_1.1fr] lg:gap-16">
          <div className="overflow-hidden rounded-3xl border border-zinc-200/80 bg-white p-3 shadow-xl">
            <GateArt className="w-full overflow-hidden rounded-2xl" />
          </div>
          <div>
            <div className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-emerald-600">
              Deterministic Verification
            </div>
            <h2 className="mt-3 text-3xl font-extrabold tracking-tight text-zinc-900 sm:text-5xl">
              Speed stops <span className="text-emerald-600">mattering.</span>
            </h2>
            <p className="mt-5 text-base sm:text-lg font-light leading-relaxed text-zinc-600">
              When ticket sellers use first-come-first-served, they unintentionally create an arms race that regular fans cannot win. Server-side randomized queueing ensures that everyone who registers within the window has the exact same mathematical probability.
            </p>
            <div className="mt-8 space-y-4">
              <div className="flex items-start gap-3.5">
                <span className="grid size-6 shrink-0 place-items-center rounded-full bg-emerald-100 text-xs font-bold text-emerald-700">✓</span>
                <p className="text-sm text-zinc-600 font-light"><strong className="text-zinc-900 font-semibold">No fast-finger tax:</strong> Register comfortably at your own pace while the pool is open.</p>
              </div>
              <div className="flex items-start gap-3.5">
                <span className="grid size-6 shrink-0 place-items-center rounded-full bg-emerald-100 text-xs font-bold text-emerald-700">✓</span>
                <p className="text-sm text-zinc-600 font-light"><strong className="text-zinc-900 font-semibold">Protected state:</strong> If your connection drops, your position remains safe on the server.</p>
              </div>
              <div className="flex items-start gap-3.5">
                <span className="grid size-6 shrink-0 place-items-center rounded-full bg-emerald-100 text-xs font-bold text-emerald-700">✓</span>
                <p className="text-sm text-zinc-600 font-light"><strong className="text-zinc-900 font-semibold">Auditable shuffle:</strong> Event organizers cannot hand-pick winners or cherry-pick queue spots.</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Section: FAQ Accordion Cards */}
      <section id="faq" className="scroll-mt-24 border-t border-zinc-200/70 bg-zinc-50/60 py-24 sm:py-32">
        <div className={cx(WRAP, PAD)}>
          <div className="mx-auto max-w-2xl text-center">
            <span className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3.5 py-1 text-xs font-semibold uppercase tracking-wider text-emerald-800">
              Frequently Asked Questions
            </span>
            <h2 className="mt-4 text-3xl font-extrabold tracking-tight text-zinc-900 sm:text-5xl">
              Good to <span className="text-emerald-600">know.</span>
            </h2>
            <p className="mt-4 text-base text-zinc-600 font-light">
              Clear answers on how queue randomization, Turnstile, and checkout reservations work.
            </p>
          </div>

          <div className="mx-auto mt-14 max-w-3xl space-y-4">
            {FAQ.map((item, idx) => {
              const isOpen = activeFaq === idx;
              return (
                <div
                  key={item.q}
                  className="overflow-hidden rounded-2xl border border-zinc-200/80 bg-white shadow-sm transition-all duration-200 hover:border-emerald-500/30"
                >
                  <button
                    onClick={() => setActiveFaq(isOpen ? null : idx)}
                    aria-expanded={isOpen}
                    className="flex w-full cursor-pointer items-center justify-between gap-6 p-6 text-left"
                  >
                    <span className="text-base sm:text-lg font-semibold text-zinc-900">{item.q}</span>
                    <span
                      className={cx(
                        "grid size-8 shrink-0 place-items-center rounded-full border text-sm font-semibold transition-transform duration-200",
                        isOpen
                          ? "rotate-45 border-emerald-300 bg-emerald-50 text-emerald-700"
                          : "border-zinc-200 bg-zinc-50 text-zinc-600",
                      )}
                    >
                      +
                    </span>
                  </button>
                  {isOpen && (
                    <div className="px-6 pb-6 text-sm font-light leading-relaxed text-zinc-600 border-t border-zinc-100 pt-4">
                      {item.a}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </section>
    </main>
  );
}
