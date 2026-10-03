"use client";

import Link from "next/link";
import Image from "next/image";
import { ArrowRight, Ticket, Users, ShieldCheck, Shuffle } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { GateArt } from "@/components/illustrations";
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
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="size-6 text-zinc-900">
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
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="size-6 text-zinc-900">
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
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="size-6 text-zinc-900">
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
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="size-6 text-zinc-900">
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
  const registration = sorted?.find((e) => e.phase === "REGISTRATION_OPEN");

  const [activeFaq, setActiveFaq] = useState<number | null>(null);

  return (
    <main className="flex-1 overflow-x-hidden">

      <section className={cx(WRAP, PAD, "pt-28 pb-16 sm:pt-32 sm:pb-24")}>
        <Suspense><Denied /></Suspense>
        <div className="landing-hero">
          <div className="hero-copy">
            <span className="inline-flex w-fit items-center gap-2 rounded-full border border-zinc-400/60 px-3 py-1 text-[10px] font-medium uppercase tracking-wider">
              <span className="size-1.5 rounded-full bg-success" />
              {registration ? `${fmtNum(registration.seats_total)} limited seats` : "Limited seats. Equal chances."}
            </span>
            <h1 className="mt-7 text-[clamp(2.65rem,5.2vw,4.7rem)] font-semibold leading-[0.98] tracking-[-0.065em]">Same<br />Chance<br />For Everyone.</h1>
            <p className="mt-6 max-w-sm text-base leading-relaxed text-zinc-600">A fair, transparent and bot-protected ticket drop.<br className="hidden sm:block" /> Randomized queue. Real people only.</p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link href={registration ? eventPath(registration.id, "register") : "/events"} className={buttonClass("primary", "lg")}>Register now <ArrowRight size={17} aria-hidden /></Link>
              <Link href="/#how" className={buttonClass("ghost", "lg")}>How it works</Link>
            </div>
            <p className="mt-6 text-xs text-zinc-500">Your connection speed shouldn&apos;t decide your seat.</p>
          </div>
          <div className="hero-photo">
            <Image src="/images/fair-drop-campus.png" alt="Students arriving at a sunlit campus entrance for a Fair Drop event" fill sizes="(max-width: 767px) 100vw, 55vw" preload className="object-cover object-[75%_center]" />
            <div className="hero-photo-caption"><span className="inline-flex items-center gap-2 text-xs"><span className="size-1.5 rounded-full bg-surface" />A place for real people.</span><span className="text-xs text-white/70">Fair Drop / 2026</span></div>
          </div>
          <div className="hero-facts">
            {[
              { icon: Ticket, value: registration ? fmtNum(registration.seats_total) : "Limited", label: "Seats per drop" },
              { icon: Users, value: "1", label: "Entry per person" },
              { icon: ShieldCheck, value: "Protected", label: "Human verification" },
              { icon: Shuffle, value: "Equal", label: "Chance for everyone" },
            ].map(({ icon: Icon, value, label }) => <div key={label} className="flex items-start gap-2.5"><Icon size={16} className="mt-0.5 shrink-0" aria-hidden /><div><p className="text-sm font-semibold">{value}</p><p className="mt-1 text-[11px] text-zinc-500">{label}</p></div></div>)}
          </div>
        </div>
      </section>

      {/* Marquee Ticker */}
      <section className="overflow-hidden border-y border-line bg-zinc-100/60 py-4.5" aria-label="Core Principles">
        <div className="marquee flex w-max gap-10 whitespace-nowrap">
          {[...PHRASES, ...PHRASES, ...PHRASES, ...PHRASES].map((p, i) => (
            <span key={i} className="flex items-center gap-10 text-xl font-normal italic tracking-tight text-zinc-700 sm:text-2xl">
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
            <div className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-zinc-900">
              <span className="size-1.5 rounded-full bg-emerald-500 pulse-dot" aria-hidden />
              On The Calendar
            </div>
            <h2 className="mt-3 text-3xl font-semibold tracking-tight text-zinc-900 sm:text-5xl">
              Live &amp; upcoming <span className="text-zinc-900">drops</span>
            </h2>
            <p className="mt-3 text-base text-zinc-500 font-normal max-w-xl">
              Discover verified drops currently accepting registrations or live in admission.
            </p>
          </div>
          <Link
            href="/events"
            className="group inline-flex items-center gap-2 text-sm font-semibold text-zinc-900 hover:text-fg transition-colors"
          >
            View all drops
            <span aria-hidden className="transition-transform group-hover:translate-x-1">→</span>
          </Link>
        </div>

        {/* Live Highlight Banner if an event is currently admitting */}
        {live && (
          <div className="mt-10 overflow-hidden rounded-xl border border-emerald-300/80 bg-gradient-to-r from-bg-2 to-surface p-6 sm:p-8 backdrop-blur-sm">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
              <div className="space-y-2">
                <div className="inline-flex items-center gap-2 rounded-full bg-emerald-600 px-3 py-1 text-xs font-semibold text-white shadow-sm">
                  <span className="size-2 rounded-full bg-surface pulse-dot" />
                  ADMISSION BATCH IN PROGRESS
                </div>
                <h3 className="text-2xl font-semibold text-zinc-900 sm:text-3xl">{live.name}</h3>
                <p className="text-sm text-zinc-600 font-normal max-w-2xl">{live.tagline}</p>
              </div>

              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-6 lg:border-l lg:border-line lg:pl-8">
                <div className="space-y-1.5 min-w-[200px]">
                  <div className="flex justify-between text-xs text-zinc-600">
                    <span>Remaining capacity</span>
                    <span className="font-semibold text-zinc-900">{fmtNum(seatsLeft(live))} / {fmtNum(live.seats_total)}</span>
                  </div>
                  <ProgressBar value={live.seats_confirmed / live.seats_total} label="Seats allocation" tone="success" className="h-2.5" />
                  <div className="text-[11px] text-zinc-500 font-normal">{fmtPrice(live.price_inr)} · {live.city}</div>
                </div>

                <Link
                  href={eventPath(live.id)}
                  className={cx(buttonClass("primary", "md"), "shrink-0 shadow-sm ")}
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
      <section id="how" className="scroll-mt-24 border-y border-line bg-zinc-50/70 py-24 sm:py-32">
        <div className={cx(WRAP, PAD)}>
          <div className="grid gap-16 lg:grid-cols-[1fr_1.2fr] lg:gap-20 items-start">
            {/* Left Column: Heading and philosophy */}
            <div className="lg:sticky lg:top-28 space-y-6">
              <div className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3.5 py-1 text-xs font-semibold uppercase tracking-wider text-emerald-800">
                Architected for Fairness
              </div>
              <h2 className="text-3xl font-semibold tracking-tight text-zinc-900 sm:text-5xl leading-tight">
                Four steps. <br />
                <span className="text-zinc-900">No shortcuts.</span>
              </h2>
              <p className="text-lg text-zinc-600 font-normal leading-relaxed">
                Traditional ticketing rewards whoever has the fastest bot or nearest datacenter. Fair Drop turns high-demand drops into a verified, calm lottery where everybody has identical odds.
              </p>

              <div className="rounded-xl border border-line bg-surface p-6 shadow-sm space-y-4">
                <div className="text-xs font-semibold uppercase tracking-wider text-zinc-500">The Fair Drop Guarantee</div>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div className="space-y-1">
                    <div className="num text-2xl font-semibold text-zinc-900">1 : 1</div>
                    <div className="text-xs text-zinc-500 font-normal">Person per registered entry</div>
                  </div>
                  <div className="space-y-1">
                    <div className="num text-2xl font-semibold text-zinc-900">5 min</div>
                    <div className="text-xs text-zinc-500 font-normal">Guaranteed checkout window</div>
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
                  className="group relative overflow-hidden rounded-xl border border-line bg-surface p-7 shadow-sm transition-all duration-300 hover:border-zinc-400 shadow-sm "
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-center gap-4">
                      <div className="grid size-12 place-items-center rounded-xl bg-emerald-50 border border-emerald-100/80 group-hover:bg-emerald-100/60 transition-colors">
                        {s.icon}
                      </div>
                      <div>
                        <div className="text-xs font-semibold uppercase tracking-wider text-zinc-900">{s.subtitle}</div>
                        <h3 className="text-xl font-semibold text-zinc-900">{s.title}</h3>
                      </div>
                    </div>
                    <span className="num text-2xl font-semibold text-zinc-200 group-hover:text-emerald-200 transition-colors">
                      {s.num}
                    </span>
                  </div>
                  <p className="mt-4 text-sm font-normal leading-relaxed text-zinc-600 pl-16">
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
          <div className="relative overflow-hidden rounded-xl bg-zinc-900 px-6 py-16 text-white sm:px-12 sm:py-24 lg:px-16 border border-white/10 shadow-sm">
            {/* Ambient emerald glowing orbs */}

            <div className="relative max-w-3xl">
              <span className="inline-flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3.5 py-1 text-xs font-semibold uppercase tracking-wider text-zinc-200">
                <span className="size-1.5 rounded-full bg-emerald-400 pulse-dot" />
                Zero-Trust Anti-Scalping Architecture
              </span>
              <h2 className="mt-4 text-3xl font-semibold tracking-tight sm:text-5xl lg:text-6xl text-white">
                Engineered to make <br />
                <span className="text-zinc-200">bots powerless.</span>
              </h2>
              <p className="mt-5 text-base sm:text-lg text-zinc-300 font-normal leading-relaxed">
                By separating registration from queue draw and locking entries before shuffle, Fair Drop renders sub-second scripts, automated clickers, and proxies entirely obsolete.
              </p>
            </div>

            {/* 4 Pillars Grid */}
            <div className="relative mt-14 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
              {DEFENSE_PILLARS.map((p) => (
                <div
                  key={p.title}
                  className="rounded-xl border border-white/10 bg-surface/[0.04] p-6 backdrop-blur-md transition-all duration-300 hover:border-emerald-500/40 hover:bg-surface/[0.07]"
                >
                  <span className="text-[11px] font-semibold uppercase tracking-widest text-zinc-200">{p.tag}</span>
                  <h3 className="mt-2 text-lg font-semibold text-white">{p.title}</h3>
                  <p className="mt-3 text-xs leading-relaxed text-zinc-400 font-normal">{p.description}</p>
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
                <div key={s.label} className="rounded-xl border border-white/10 bg-surface/[0.03] p-5 backdrop-blur-sm">
                  <div className="num text-3xl font-semibold text-zinc-200 sm:text-4xl">{s.val}</div>
                  <div className="mt-2 text-xs font-semibold text-white">{s.label}</div>
                  <div className="mt-1 text-[11px] text-zinc-400 font-normal">{s.desc}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Section: Gate Art Illustration & Integrity */}
      <section className={cx(WRAP, PAD, "py-20 sm:py-28")}>
        <div className="grid items-center gap-12 lg:grid-cols-[1fr_1.1fr] lg:gap-16">
          <div className="overflow-hidden rounded-xl border border-line bg-surface p-3 shadow-sm">
            <GateArt className="w-full overflow-hidden rounded-xl" />
          </div>
          <div>
            <div className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-zinc-900">
              Deterministic Verification
            </div>
            <h2 className="mt-3 text-3xl font-semibold tracking-tight text-zinc-900 sm:text-5xl">
              Speed stops <span className="text-zinc-900">mattering.</span>
            </h2>
            <p className="mt-5 text-base sm:text-lg font-normal leading-relaxed text-zinc-600">
              When ticket sellers use first-come-first-served, they unintentionally create an arms race that regular fans cannot win. Server-side randomized queueing ensures that everyone who registers within the window has the exact same mathematical probability.
            </p>
            <div className="mt-8 space-y-4">
              <div className="flex items-start gap-3.5">
                <span className="grid size-6 shrink-0 place-items-center rounded-full bg-emerald-100 text-xs font-semibold text-emerald-700">✓</span>
                <p className="text-sm text-zinc-600 font-normal"><strong className="text-zinc-900 font-semibold">No fast-finger tax:</strong> Register comfortably at your own pace while the pool is open.</p>
              </div>
              <div className="flex items-start gap-3.5">
                <span className="grid size-6 shrink-0 place-items-center rounded-full bg-emerald-100 text-xs font-semibold text-emerald-700">✓</span>
                <p className="text-sm text-zinc-600 font-normal"><strong className="text-zinc-900 font-semibold">Protected state:</strong> If your connection drops, your position remains safe on the server.</p>
              </div>
              <div className="flex items-start gap-3.5">
                <span className="grid size-6 shrink-0 place-items-center rounded-full bg-emerald-100 text-xs font-semibold text-emerald-700">✓</span>
                <p className="text-sm text-zinc-600 font-normal"><strong className="text-zinc-900 font-semibold">Auditable shuffle:</strong> Event organizers cannot hand-pick winners or cherry-pick queue spots.</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Section: FAQ Accordion Cards */}
      <section id="faq" className="scroll-mt-24 border-t border-line bg-zinc-50/60 py-24 sm:py-32">
        <div className={cx(WRAP, PAD)}>
          <div className="mx-auto max-w-2xl text-center">
            <span className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3.5 py-1 text-xs font-semibold uppercase tracking-wider text-emerald-800">
              Frequently Asked Questions
            </span>
            <h2 className="mt-4 text-3xl font-semibold tracking-tight text-zinc-900 sm:text-5xl">
              Good to <span className="text-zinc-900">know.</span>
            </h2>
            <p className="mt-4 text-base text-zinc-600 font-normal">
              Clear answers on how queue randomization, Turnstile, and checkout reservations work.
            </p>
          </div>

          <div className="mx-auto mt-14 max-w-3xl space-y-4">
            {FAQ.map((item, idx) => {
              const isOpen = activeFaq === idx;
              return (
                <div
                  key={item.q}
                  className="overflow-hidden rounded-xl border border-line bg-surface shadow-sm transition-all duration-200 hover:border-zinc-400"
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
                          : "border-line bg-zinc-50 text-zinc-600",
                      )}
                    >
                      +
                    </span>
                  </button>
                  {isOpen && (
                    <div className="px-6 pb-6 text-sm font-normal leading-relaxed text-zinc-600 border-t border-zinc-100 pt-4">
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
