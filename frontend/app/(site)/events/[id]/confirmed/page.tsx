"use client";

import Link from "next/link";
import { eventPath } from "@/lib/state/journey";
import { useJourney } from "@/lib/state/JourneyProvider";
import { LoadState, PageShell, useRouteGuard } from "@/components/site/chrome";
import { fmtDate, fmtTime } from "@/components/site/format";
import { icsHref, Perforation, QRCard, qrValue } from "@/components/site/TicketStub";
import { buttonClass } from "@/components/ui";

export default function Confirmed() {
  const me = useRouteGuard("confirmed");
  const { event, eventId } = useJourney();
  if (me?.status !== "CONFIRMED" || !event) return <LoadState route="confirmed" />;
  const t = me.ticket;

  return (
    <PageShell>
      <div className="mx-auto max-w-5xl">
        <div className="grid grid-cols-1 items-start gap-10 lg:grid-cols-[1.1fr_420px] lg:gap-16">
          {/* Left Celebration Column */}
          <div className="rise text-center lg:text-left">
            <div className="inline-flex items-center gap-2 rounded-full border border-emerald-200/80 bg-emerald-50 px-3.5 py-1.5 text-xs font-semibold text-emerald-800">
              <span className="flex size-2 rounded-full bg-emerald-500 animate-pulse" />
              <span>Seat Allocation Confirmed</span>
            </div>

            <h1 className="page-title mt-4">
              You&apos;re <em className="accent-italic">in.</em>
            </h1>
            <p className="mt-3 text-lg text-zinc-600 max-w-lg">
              Your admission for <strong className="text-zinc-900 font-semibold">{event.name}</strong> is confirmed and permanently secured to your account.
            </p>

            {/* Quick Action Buttons */}
            <div className="mt-8 flex flex-wrap justify-center gap-3 lg:justify-start">
              <Link href={eventPath(eventId, "ticket")} className={buttonClass("primary", "lg")}>
                View Full Pass <span aria-hidden>→</span>
              </Link>
              <Link href="/events" className={buttonClass("secondary", "lg")}>
                Browse Other Drops
              </Link>
            </div>

            {/* Action Toolbar */}
            <div className="mt-8 pt-6 border-t border-line flex flex-wrap items-center justify-center lg:justify-start gap-3">
              <a
                href={icsHref(t, event)}
                download={`${event.id}.ics`}
                className="inline-flex items-center gap-2 rounded-xl border border-line bg-surface px-4 py-2.5 text-xs font-semibold text-zinc-800 shadow-sm hover:bg-zinc-50 hover:border-zinc-300 transition-all"
              >
                <svg viewBox="0 0 24 24" className="size-4 text-emerald-600" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                  <rect width="18" height="18" x="3" y="4" rx="2" ry="2" />
                  <line x1="16" x2="16" y1="2" y2="6" />
                  <line x1="8" x2="8" y1="2" y2="6" />
                  <line x1="3" x2="21" y1="10" y2="10" />
                </svg>
                Add to Calendar (.ics)
              </a>
              <button
                type="button"
                onClick={() => window.print()}
                className="inline-flex items-center gap-2 rounded-xl border border-line bg-surface px-4 py-2.5 text-xs font-semibold text-zinc-800 shadow-sm hover:bg-zinc-50 hover:border-zinc-300 transition-all"
              >
                <svg viewBox="0 0 24 24" className="size-4 text-zinc-600" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                  <polyline points="6 9 6 2 18 2 18 9" />
                  <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
                  <rect width="12" height="8" x="6" y="14" />
                </svg>
                Print Ticket
              </button>
            </div>

            <p className="mt-6 text-xs text-zinc-500 max-w-md">
              Please present your live QR code upon arrival at {event.venue}. Each pass is cryptographically checked at the door against the server.
            </p>
          </div>

          {/* Right: Digital Luxury Ticket Pass with Perforated Notch Edges */}
          <article className="rise overflow-hidden rounded-xl border border-line bg-surface shadow-sm" aria-label="Digital Ticket Pass">
            {/* Top Pass Details */}
            <div className="p-7 sm:p-8">
              <div className="flex items-center justify-between gap-3">
                <span className="text-[11px] font-semibold uppercase tracking-widest text-zinc-500">Admit One</span>
                <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-emerald-700 border border-emerald-200/70">
                  <span className="size-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  VERIFIED PASS
                </span>
              </div>

              <h2 className="serif text-2xl font-semibold text-zinc-900 mt-4 leading-tight">{event.name}</h2>
              <p className="text-xs text-zinc-500 mt-1">{event.venue}, {event.city}</p>

              <dl className="mt-6 grid grid-cols-3 gap-3 border-t border-zinc-100 pt-5 text-xs">
                <div>
                  <dt className="text-zinc-500">Date</dt>
                  <dd className="mt-1 font-semibold text-zinc-900">{fmtDate(event.starts_at)}</dd>
                </div>
                <div>
                  <dt className="text-zinc-500">Doors</dt>
                  <dd className="mt-1 font-semibold text-zinc-900">{fmtTime(event.starts_at)}</dd>
                </div>
                <div>
                  <dt className="text-zinc-500">Seat</dt>
                  <dd className="serif num mt-0.5 text-xl font-semibold text-emerald-600">{t.seat_label}</dd>
                </div>
              </dl>
            </div>

            {/* Perforated Notch Edge Divider */}
            <Perforation />

            {/* Bottom QR Section */}
            <div className="p-7 sm:p-8 pt-4 bg-zinc-50/50 flex flex-col items-center">
              <QRCard value={qrValue(t)} size={140} />

              <div className="mt-3 text-center">
                <div className="text-[10px] font-semibold uppercase tracking-widest text-zinc-500">Ticket Identifier</div>
                <div className="num font-mono mt-1 text-xs font-semibold tracking-wider text-zinc-900" data-testid="ticket-id">
                  {t.ticket_id}
                </div>
              </div>

              <div className="mt-5 w-full flex items-center justify-center gap-4 text-xs font-semibold">
                <a href={icsHref(t, event)} download={`${event.id}.ics`} className="text-emerald-700 hover:text-fg hover:underline">
                  Add to Calendar (.ics)
                </a>
                <span className="text-zinc-300">·</span>
                <button type="button" onClick={() => window.print()} className="text-zinc-700 hover:text-zinc-900 hover:underline">
                  Print Ticket
                </button>
              </div>
            </div>
          </article>
        </div>
      </div>
    </PageShell>
  );
}
