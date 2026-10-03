"use client";

import Link from "next/link";
import { eventPath } from "@/lib/state/journey";
import { useJourney } from "@/lib/state/JourneyProvider";
import { EmptyArt } from "@/components/illustrations";
import { BackLink, LoadState, PageShell, useRouteGuard } from "@/components/site/chrome";
import { fmtNum } from "@/components/site/format";

// End states: expired window, event full, not eligible.
export default function Status() {
  const me = useRouteGuard("status");
  const { event, eventId } = useJourney();
  if (!me || !event) return <LoadState />;

  const isExpired = me.status === "EXPIRED";
  const isSoldOut = me.status === "SOLD_OUT";
  const isIneligible = me.status === "INELIGIBLE";

  const config = isExpired
    ? {
        badgeTone: "bg-amber-50 text-amber-800 border-amber-200/80",
        badgeText: "Hold Window Elapsed",
        eyebrow: "Reservation Ended",
        title: "Your reservation expired",
        body: "Your seat was released because the confirmation window ended. It immediately passed to the next waiting participant in the queue. Because entries are one per verified person, there is no second turn for this drop.",
        reassurance: "Enforcing strict reservation windows ensures abandoned tickets don't block waiting fans. Explore our other open drops to secure tickets.",
      }
    : isSoldOut
      ? {
          badgeTone: "bg-zinc-100 text-zinc-800 border-zinc-200/80",
          badgeText: "Drop Concluded",
          eyebrow: "All Seats Claimed",
          title: "This drop is sold out",
          body: me.entry_id
            ? `All ${fmtNum(event.seats_total)} seats were confirmed before the queue reached your position. Your queue position was 100% randomly drawn, with no priority given to bots or early arrivals.`
            : `All ${fmtNum(event.seats_total)} seats in this drop have been allocated and confirmed.`,
          reassurance: "Every seat was audited and claimed fairly. Check back for upcoming ticket drops and special releases.",
        }
      : {
          badgeTone: "bg-red-50 text-red-800 border-red-200/80",
          badgeText: "Eligibility Notice",
          eyebrow: "Restricted Drop",
          title: "This account can't enter",
          body: isIneligible ? me.reason : "This event requires specific verified eligibility criteria that were not satisfied.",
          reassurance: "Some drops are restricted to verified educational organizations or partner communities. Other open public drops are available.",
        };

  return (
    <PageShell className="pt-8 sm:pt-10">
      <div className="mx-auto max-w-3xl">
        <BackLink href={eventPath(eventId)}>{event.name}</BackLink>

        {/* Central Graceful Card */}
        <div className="mt-8 bg-white p-8 sm:p-12 rounded-3xl border border-zinc-200/80 shadow-xl shadow-emerald-900/5 text-center">
          <EmptyArt className="mx-auto overflow-hidden rounded-2xl w-full max-w-[280px]" />

          <div className="mt-8 flex justify-center">
            <span className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-semibold border ${config.badgeTone}`}>
              <span className="size-1.5 rounded-full bg-current" />
              {config.badgeText}
            </span>
          </div>

          <div className="eyebrow mt-4">{config.eyebrow}</div>
          <h1 className="display mt-2 text-[clamp(2.2rem,5vw,3.6rem)] text-zinc-900">{config.title}</h1>
          <p className="mt-4 text-base leading-relaxed text-zinc-600 max-w-xl mx-auto">{config.body}</p>

          {/* Supportive Telemetry / Transparency Stats */}
          {isSoldOut && (
            <div className="mt-8 grid grid-cols-2 sm:grid-cols-3 gap-3 text-left">
              <div className="rounded-2xl border border-zinc-100 bg-zinc-50/80 p-4">
                <div className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">Seats Allocated</div>
                <div className="num mt-1 text-xl font-bold text-zinc-900">{fmtNum(event.seats_confirmed)} / {fmtNum(event.seats_total)}</div>
              </div>
              <div className="rounded-2xl border border-zinc-100 bg-zinc-50/80 p-4">
                <div className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">Total Entrants</div>
                <div className="num mt-1 text-xl font-bold text-zinc-900">{fmtNum(event.registrations)}</div>
              </div>
              <div className="col-span-2 sm:col-span-1 rounded-2xl border border-zinc-100 bg-zinc-50/80 p-4">
                <div className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">Fairness Audit</div>
                <div className="mt-1 text-xs font-semibold text-emerald-700">✓ Verified Shuffle</div>
              </div>
            </div>
          )}

          <div className="mt-6 rounded-2xl border border-zinc-100 bg-zinc-50/60 p-4 text-xs text-zinc-500 max-w-xl mx-auto">
            {config.reassurance}
          </div>

          {/* Action Toolbar */}
          <div className="mt-9 flex flex-wrap justify-center gap-3">
            <Link
              href="/events"
              className="inline-flex items-center justify-center gap-2 font-semibold bg-emerald-600 hover:bg-emerald-700 text-white py-3.5 px-7 rounded-xl shadow-lg shadow-emerald-900/10 transition-all text-sm active:scale-[0.99]"
            >
              Browse other drops <span aria-hidden>→</span>
            </Link>
            <Link
              href={eventPath(eventId)}
              className="inline-flex items-center justify-center gap-2 font-semibold bg-white hover:bg-zinc-50 border border-zinc-200 hover:border-zinc-300 text-zinc-800 py-3.5 px-6 rounded-xl shadow-sm transition-all text-sm"
            >
              Back to {event.name}
            </Link>
          </div>
        </div>
      </div>
    </PageShell>
  );
}
