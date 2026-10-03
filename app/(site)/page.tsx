"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { GateArt, HeroArt } from "@/components/illustrations";
import { PAD, WRAP } from "@/components/site/chrome";
import { EventCard, EventCardSkeleton } from "@/components/site/EventCard";
import { fmtNum, PHASE_ORDER } from "@/components/site/format";
import { useEvents } from "@/components/site/useEvents";
import { buttonClass, cx } from "@/components/ui";
import { eventPath } from "@/lib/state/journey";

const PHRASES = ["one person, one entry", "no head start", "order drawn at random", "refresh all you like", "bots get nothing", "five minutes to confirm"];

const STEPS = [
  ["Register", "Sign in with Google and pass a quick human check while registration is open. When you join doesn't matter."],
  ["Freeze", "Registration closes and the list locks. Refreshes, reconnects and extra tabs can't change an entry."],
  ["Draw", "The server shuffles every entry once with a secure random seed and stores the order. Your number is final."],
  ["Your turn", "Seats open in small batches. When it's your turn you get five minutes to confirm one seat."],
];

const FAQ = [
  ["Does registering early help?", "No. Every entry gets a random position after registration closes, so the first and the last person to register have the same chance."],
  ["Can I refresh or open another tab?", "Yes. Your entry and position live on the server. You'll land back on the same screen, in the same place."],
  ["What stops bots?", "A human check on registration, one entry per verified Google account, and rate limits on every request. Sending more requests doesn't buy a better position."],
  ["What if I miss my five minutes?", "The seat goes to the next person in the queue. Entries are one per person, so there's no second turn in the same drop."],
  ["Can I enter more than one event?", "Yes. Each event runs its own drop. You get one entry per event, and My tickets shows where you stand in each."],
];

function Denied() {
  const p = useSearchParams();
  if (p.get("denied") !== "admin") return null;
  return <p className="mx-auto mb-6 w-fit rounded-full bg-[#f6e1dd] px-4 py-2 text-sm text-danger">The admin area needs an admin account.</p>;
}

export default function Home() {
  const { data: events } = useEvents();
  const sorted = events ? [...events].sort((a, b) => PHASE_ORDER[a.phase] - PHASE_ORDER[b.phase]) : undefined;
  const live = sorted?.find((e) => e.phase === "ADMITTING");

  return (
    <main className="flex-1">
      {/* hero */}
      <section className={cx(WRAP, PAD, "relative pt-10 sm:pt-16")}>
        <Suspense>
          <Denied />
        </Suspense>
        <div className="grid items-center gap-10 lg:grid-cols-[1.05fr_1fr]">
          <div className="rise">
            <span className="inline-flex items-center gap-2 rounded-full bg-accent-soft/80 px-4 py-1.5 text-[12px] font-bold uppercase tracking-[0.18em] text-[#a2662a]">
              <span className="size-1.5 rounded-full bg-accent" aria-hidden />
              Fair ticket drops
            </span>
            <h1 className="display mt-7 text-[clamp(3.2rem,7.2vw,6.2rem)]">
              Tickets without
              <br />
              the <em>race.</em>
            </h1>
            <p className="mt-7 max-w-[520px] text-lg leading-relaxed text-muted sm:text-xl">
              Book the events everyone wants, fairly. One entry per person, a queue drawn at random, and nothing to gain from refreshing or
              running a bot.
            </p>
            <div className="mt-9 flex flex-wrap gap-3">
              <Link href="/events" className={buttonClass("primary", "lg")}>
                Browse drops <span aria-hidden>→</span>
              </Link>
              <Link href="/#how" className={buttonClass("secondary", "lg")}>
                How it works
              </Link>
            </div>
          </div>

          <div className="relative mx-auto w-full max-w-[560px]">
            <HeroArt className="w-full overflow-hidden rounded-[32px]" />
            {live && (
              <Link
                href={eventPath(live.id)}
                className="float absolute left-0 top-[8%] w-56 rounded-[18px] border border-line bg-surface/95 p-4 shadow-[var(--shadow-soft)] backdrop-blur sm:-left-6"
              >
                <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.16em] text-success">
                  <span className="pulse-dot size-1.5 rounded-full bg-current" aria-hidden />
                  Live now
                </div>
                <div className="serif mt-1.5 text-xl font-semibold leading-tight">{live.name}</div>
                <div className="mt-1 text-[13px] text-muted">
                  <span className="num">{fmtNum(live.seats_total - live.seats_confirmed)}</span> of {fmtNum(live.seats_total)} seats left
                </div>
              </Link>
            )}
            <div className="float absolute bottom-[12%] right-0 w-52 rounded-[18px] border border-line bg-surface/95 p-4 shadow-[var(--shadow-soft)] backdrop-blur [animation-delay:-3s] sm:-right-4">
              <div className="eyebrow text-[10px]">Your position</div>
              <div className="serif num mt-1 text-4xl font-semibold leading-none">142</div>
              <div className="mt-2 text-[13px] italic text-muted serif">drawn at random, and final</div>
            </div>
          </div>
        </div>
      </section>

      {/* marquee */}
      <section className="mt-16 overflow-hidden border-y border-line bg-bg-2/70 py-5 sm:mt-24" aria-label="Principles">
        <div className="marquee flex w-max gap-10 whitespace-nowrap">
          {[...PHRASES, ...PHRASES, ...PHRASES, ...PHRASES].map((p, i) => (
            <span key={i} className="serif flex items-center gap-10 text-[clamp(1.6rem,3vw,2.4rem)] italic text-fg/80">
              {p}
              <span className="size-1.5 rounded-full bg-accent-2" aria-hidden />
            </span>
          ))}
        </div>
      </section>

      {/* drops */}
      <section className={cx(WRAP, PAD, "py-20 sm:py-28")}>
        <div className="flex flex-wrap items-end justify-between gap-6">
          <div>
            <div className="eyebrow">On the calendar</div>
            <h2 className="display mt-4 text-[clamp(2.4rem,5vw,3.8rem)]">
              This season&apos;s <em>drops</em>
            </h2>
          </div>
          <Link href="/events" className="text-[15px] font-semibold text-accent hover:underline hover:underline-offset-4">
            View all events <span aria-hidden>→</span>
          </Link>
        </div>
        <div className="mt-12 grid gap-7 sm:grid-cols-2 lg:grid-cols-3">
          {sorted ? sorted.slice(0, 6).map((e) => <EventCard key={e.id} event={e} />) : Array.from({ length: 3 }, (_, i) => <EventCardSkeleton key={i} />)}
        </div>
      </section>

      {/* how */}
      <section id="how" className="scroll-mt-24 border-y border-line bg-surface/60">
        <div className={cx(WRAP, PAD, "py-20 sm:py-28")}>
          <div className="mx-auto max-w-2xl text-center">
            <div className="eyebrow">How a drop works</div>
            <h2 className="display mt-4 text-[clamp(2.4rem,5vw,3.8rem)]">
              Four steps, <em>no shortcuts.</em>
            </h2>
            <p className="mt-5 text-lg text-muted">The same rules for everyone, every event, every time.</p>
          </div>
          <ol className="relative mt-16 grid gap-10 md:grid-cols-4 md:gap-6">
            <span className="absolute left-[12%] right-[12%] top-7 hidden border-t-2 border-dashed border-accent-2/60 md:block" aria-hidden />
            {STEPS.map(([title, body], i) => (
              <li key={title} className="relative text-center">
                <span className="serif relative mx-auto grid h-14 min-w-28 w-fit place-items-center rounded-full border border-line bg-surface px-6 text-2xl italic shadow-[var(--shadow-soft)]">
                  {title}
                </span>
                <span className="num mt-5 block text-xs font-bold tracking-[0.2em] text-accent">0{i + 1}</span>
                <p className="mx-auto mt-2 max-w-[260px] text-[15px] leading-relaxed text-muted">{body}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* proof */}
      <section className={cx(WRAP, PAD, "py-20 sm:py-28")}>
        <div className="grid items-center gap-14 lg:grid-cols-[1fr_1.1fr]">
          <GateArt className="mx-auto w-full max-w-[420px] overflow-hidden rounded-[32px]" />
          <div>
            <div className="eyebrow">Why it&apos;s fair</div>
            <h2 className="display mt-4 text-[clamp(2.4rem,5vw,3.8rem)]">
              Speed stops <em>mattering.</em>
            </h2>
            <p className="mt-6 max-w-lg text-lg leading-relaxed text-muted">
              First-come-first-served rewards whoever clicks fastest, which usually means whoever runs a script. A fair drop removes the race, so a
              slow connection and a fast one have the same odds.
            </p>
            <dl className="mt-10 grid grid-cols-3 gap-6 border-t border-line pt-8">
              {[
                ["1", "entry per person, per event"],
                ["0", "seats ever sold twice"],
                ["5 min", "to confirm when it's your turn"],
              ].map(([v, l]) => (
                <div key={l}>
                  <dt className="sr-only">{l}</dt>
                  <dd className="serif num text-[clamp(2.4rem,4.5vw,3.6rem)] font-semibold leading-none text-accent">{v}</dd>
                  <p className="mt-3 text-sm leading-snug text-muted">{l}</p>
                </div>
              ))}
            </dl>
          </div>
        </div>
      </section>

      {/* faq */}
      <section id="faq" className="scroll-mt-24 border-t border-line bg-bg-2/50">
        <div className={cx(WRAP, PAD, "grid gap-12 py-20 sm:py-28 lg:grid-cols-[1fr_1.6fr] lg:gap-20")}>
          <div>
            <div className="eyebrow">Questions</div>
            <h2 className="display mt-4 text-[clamp(2.4rem,5vw,3.8rem)]">
              Good to <em>know.</em>
            </h2>
          </div>
          <div className="space-y-3">
            {FAQ.map(([q, a]) => (
              <details key={q} className="group rounded-[18px] border border-line bg-surface px-6 shadow-[var(--shadow-soft)]">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-6 py-5 text-[17px] font-semibold [&::-webkit-details-marker]:hidden">
                  {q}
                  <span className="grid size-8 shrink-0 place-items-center rounded-full bg-bg-2 text-lg text-accent transition-transform duration-200 group-open:rotate-45" aria-hidden>
                    +
                  </span>
                </summary>
                <p className="max-w-2xl pb-6 leading-relaxed text-muted">{a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}
