"use client";

import Link from "next/link";
import { eventPath } from "@/lib/state/journey";
import { useJourney } from "@/lib/state/JourneyProvider";
import { EmptyArt } from "@/components/illustrations";
import { LoadState, PageShell, useRouteGuard } from "@/components/site/chrome";
import { buttonClass } from "@/components/ui";

// End states: expired window, event full, not eligible.
export default function Status() {
  const me = useRouteGuard("status");
  const { event, eventId } = useJourney();
  if (!me || !event) return <LoadState />;

  const c =
    me.status === "EXPIRED"
      ? {
          eyebrow: "Reservation ended",
          title: "Your reservation expired",
          body: "Your seat was released because the confirmation window ended. It went to the next person in the queue. Entries are one per person, so there isn't a second turn in this drop.",
        }
      : me.status === "SOLD_OUT"
        ? {
            eyebrow: "Event full",
            title: "This event is full",
            body: me.entry_id
              ? `All ${event.seats_total.toLocaleString("en-IN")} seats were confirmed before the queue reached you. Your place was random, and nobody could skip ahead of it.`
              : `All ${event.seats_total.toLocaleString("en-IN")} seats have been confirmed.`,
          }
        : {
            eyebrow: "Not eligible",
            title: "This account can't enter",
            body: me.status === "INELIGIBLE" ? me.reason : "",
          };

  return (
    <PageShell>
      <div className="mx-auto max-w-xl text-center">
        <EmptyArt className="mx-auto overflow-hidden rounded-[28px] w-full max-w-[320px]" />
        <div className="eyebrow mt-8">{c.eyebrow}</div>
        <h1 className="display mt-4 text-[clamp(2.6rem,6vw,4rem)]">{c.title}</h1>
        <p className="mt-5 text-lg leading-relaxed text-muted">{c.body}</p>
        <div className="mt-9 flex flex-wrap justify-center gap-3">
          <Link href="/events" className={buttonClass("primary")}>
            Browse other events
          </Link>
          <Link href={eventPath(eventId)} className={buttonClass("secondary")}>
            Back to {event.name}
          </Link>
        </div>
      </div>
    </PageShell>
  );
}
