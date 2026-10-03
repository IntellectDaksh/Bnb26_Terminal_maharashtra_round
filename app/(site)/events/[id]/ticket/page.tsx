"use client";

import { eventPath } from "@/lib/state/journey";
import { useJourney } from "@/lib/state/JourneyProvider";
import { BackLink, LoadState, PageShell, useRouteGuard } from "@/components/site/chrome";
import { fmtDateLong, fmtTime } from "@/components/site/format";
import { icsHref, Perforation, QRCard, qrValue } from "@/components/site/TicketStub";
import { Button, buttonClass, StatusBadge, Wordmark } from "@/components/ui";

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
    ["Ticket type", "General admission"],
  ];

  return (
    <PageShell className="pt-8 sm:pt-10">
      <div className="mx-auto max-w-4xl">
        <div className="print:hidden">
          <BackLink href={eventPath(eventId)}>{event.name}</BackLink>
        </div>
        <div className="mt-6 flex flex-wrap items-end justify-between gap-6 print:hidden">
          <h1 className="display text-[clamp(2.6rem,5vw,3.8rem)]">
            Your <em>ticket.</em>
          </h1>
          <div className="flex gap-3">
            <a href={icsHref(t, event)} download={`${event.id}.ics`} className={buttonClass("secondary", "sm")}>
              Add to calendar
            </a>
            <Button size="sm" onClick={() => window.print()}>
              Print
            </Button>
          </div>
        </div>

        <article className="rise mt-10 flex flex-col overflow-hidden rounded-[26px] border border-line/80 bg-surface shadow-[var(--shadow-soft)] md:flex-row" aria-label="Ticket">
          <div className="flex-1 p-8 sm:p-10">
            <div className="flex items-center justify-between gap-4">
              <Wordmark className="text-[18px]" />
              <StatusBadge tone="success">Verified · confirmed</StatusBadge>
            </div>
            <h2 className="display mt-10 text-[clamp(2.4rem,5vw,3.6rem)]">{event.name}</h2>
            <p className="serif mt-1 text-xl italic text-muted">{event.organizer}</p>
            <dl className="mt-10 grid grid-cols-2 gap-x-8 gap-y-6 border-t border-line pt-7 sm:grid-cols-3">
              {rows.map(([k, v, big]) => (
                <div key={k} className="min-w-0">
                  <dt className="text-[13px] text-muted">{k}</dt>
                  <dd className={big ? "serif num mt-0.5 text-3xl font-semibold" : "mt-1 font-semibold"}>{v}</dd>
                </div>
              ))}
            </dl>
          </div>
          <div className="md:hidden">
            <Perforation />
          </div>
          <div className="hidden md:flex">
            <Perforation vertical />
          </div>
          <div className="flex flex-col items-center justify-center gap-5 bg-bg-2/40 p-8 sm:p-10 md:w-64">
            <QRCard value={qrValue(t)} size={148} />
            <div className="text-center">
              <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-muted">Ticket ID</div>
              <div className="num mt-1 text-sm font-bold tracking-wider" data-testid="ticket-id">
                {t.ticket_id}
              </div>
            </div>
          </div>
        </article>
        <p className="mt-6 text-[13px] text-muted">
          Confirmed {new Date(t.confirmed_at).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}. Checked against the server at the door,
          so a screenshot of someone else&apos;s code won&apos;t scan.
        </p>
      </div>
    </PageShell>
  );
}
