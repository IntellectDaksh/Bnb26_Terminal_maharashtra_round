"use client";

import { eventPath } from "@/lib/state/journey";
import { useJourney } from "@/lib/state/JourneyProvider";
import { BackLink, LoadState, PageShell, useRouteGuard } from "@/components/site/chrome";
import { fmtDateLong, fmtTime } from "@/components/site/format";
import { icsHref, Perforation, QRCard, qrValue } from "@/components/site/TicketStub";
import { Wordmark } from "@/components/ui";

export default function TicketPage() {
  const me = useRouteGuard("ticket", "confirmed");
  const { event, eventId } = useJourney();
  if (me?.status !== "CONFIRMED" || !event) return <LoadState route="ticket" />;
  const t = me.ticket;

  const rows: [string, string, boolean?][] = [
    ["Attendee", t.holder_name],
    ["Seat", t.seat_label, true],
    ["Date", fmtDateLong(event.starts_at)],
    ["Time", `${fmtTime(event.starts_at)} IST`],
    ["Venue", `${event.venue}, ${event.city}`],
    ["Ticket Type", "General Admission (1 Ticket)"],
  ];

  return (
    <PageShell>
      <div className="mx-auto max-w-4xl">
        {/* Navigation & Action Toolbar */}
        <div className="print:hidden">
          <BackLink href={eventPath(eventId)}>{event.name}</BackLink>
        </div>

        <div className="mt-6 flex flex-wrap items-end justify-between gap-4 print:hidden">
          <div>
            <span className="eyebrow">Verified Admission</span>
            <h1 className="page-title mt-1">
              Your <em className="accent-italic">ticket pass.</em>
            </h1>
          </div>

          {/* Action Toolbar */}
          <div className="flex flex-wrap items-center gap-3">
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
        </div>

        {/* Digital Luxury Ticket Pass Card */}
        <article
          className="rise mt-8 flex flex-col overflow-hidden rounded-xl border border-line bg-surface shadow-sm  md:flex-row print:shadow-none print:border-zinc-300"
          aria-label="Official Ticket Pass"
        >
          {/* Main Pass Information */}
          <div className="flex-1 p-8 sm:p-10">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <Wordmark className="text-sm font-semibold" />
              <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-800 border border-emerald-200/70">
                <span className="size-2 rounded-full bg-emerald-500 animate-pulse" />
                VERIFIED PASS · CONFIRMED
              </span>
            </div>

            <div className="mt-8">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-emerald-600">{event.organizer}</span>
              <h2 className="serif mt-1 text-[clamp(2rem,4vw,3rem)] font-semibold text-zinc-900 leading-tight">
                {event.name}
              </h2>
            </div>

            <dl className="mt-8 grid grid-cols-2 gap-x-8 gap-y-5 border-t border-zinc-100 pt-7 sm:grid-cols-3">
              {rows.map(([k, v, big]) => (
                <div key={k} className="min-w-0">
                  <dt className="text-xs text-zinc-500 font-medium">{k}</dt>
                  <dd className={big ? "serif num mt-0.5 text-2xl sm:text-3xl font-semibold text-emerald-600" : "mt-1 text-sm font-semibold text-zinc-900"}>
                    {v}
                  </dd>
                </div>
              ))}
            </dl>
          </div>

          {/* Perforated Notches: Horizontal on Mobile, Vertical on MD+ */}
          <div className="md:hidden">
            <Perforation />
          </div>
          <div className="hidden md:flex">
            <Perforation vertical />
          </div>

          {/* Right Ticket Stub with High-Contrast QR Code */}
          <div className="flex flex-col items-center justify-center gap-5 bg-zinc-50/60 p-8 sm:p-10 md:w-72 print:bg-white">
            <QRCard value={qrValue(t)} size={152} />

            <div className="text-center">
              <div className="text-[10px] font-semibold uppercase tracking-[0.2em] text-zinc-500">Ticket ID</div>
              <div className="num font-mono mt-1 text-xs font-semibold tracking-wider text-zinc-900" data-testid="ticket-id">
                {t.ticket_id}
              </div>
            </div>

            <div className="text-center text-[11px] text-zinc-500">
              Show at entrance gate
            </div>
          </div>
        </article>

        {/* Footnote / Verification Details */}
        <p className="mt-6 text-xs text-zinc-500 leading-relaxed print:hidden">
          Confirmed on {new Date(t.confirmed_at).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}. Checked against server validation at the door; duplicate screenshots or revoked tickets will not scan.
        </p>
      </div>
    </PageShell>
  );
}
