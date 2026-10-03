"use client";

import Link from "next/link";
import { eventPath } from "@/lib/state/journey";
import { useJourney } from "@/lib/state/JourneyProvider";
import { TicketArt } from "@/components/illustrations";
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
      <div className="grid items-center gap-12 lg:grid-cols-[1fr_440px] lg:gap-20">
        <div className="rise text-center lg:text-left">
          <TicketArt className="mx-auto w-full max-w-[340px] overflow-hidden rounded-[28px] lg:mx-0" />
          <h1 className="display mt-6 text-[clamp(3.2rem,8vw,6rem)]">
            You&apos;re <em>in.</em>
          </h1>
          <p className="mt-4 text-lg text-muted">Your seat for {event.name} is confirmed and locked to your account.</p>
          <div className="mt-8 flex flex-wrap justify-center gap-3 lg:justify-start">
            <Link href={eventPath(eventId, "ticket")} className={buttonClass("primary", "lg")}>
              View my ticket
            </Link>
            <Link href="/events" className={buttonClass("secondary", "lg")}>
              Find another event
            </Link>
          </div>
        </div>

        <article className="rise overflow-hidden rounded-[26px] border border-line/80 bg-surface shadow-[var(--shadow-soft)]">
          <div className="p-8">
            <div className="eyebrow">Admit one</div>
            <div className="serif mt-2 text-3xl font-semibold">{event.name}</div>
            <dl className="mt-6 grid grid-cols-3 gap-4 text-sm">
              <div>
                <dt className="text-muted">Date</dt>
                <dd className="mt-1 font-semibold">{fmtDate(event.starts_at)}</dd>
              </div>
              <div>
                <dt className="text-muted">Doors</dt>
                <dd className="mt-1 font-semibold">{fmtTime(event.starts_at)}</dd>
              </div>
              <div>
                <dt className="text-muted">Seat</dt>
                <dd className="serif num mt-0.5 text-2xl font-semibold">{t.seat_label}</dd>
              </div>
            </dl>
            <p className="mt-4 text-sm text-muted">
              {event.venue}, {event.city}
            </p>
          </div>
          <Perforation />
          <div className="px-8 pb-8">
            <QRCard value={qrValue(t)} />
            <div className="num mt-3 text-center text-xs font-semibold tracking-wider text-muted" data-testid="ticket-id">
              {t.ticket_id}
            </div>
            <a href={icsHref(t, event)} download={`${event.id}.ics`} className="mt-6 block text-center text-sm font-semibold text-accent hover:underline">
              Add to calendar
            </a>
          </div>
        </article>
      </div>
    </PageShell>
  );
}
