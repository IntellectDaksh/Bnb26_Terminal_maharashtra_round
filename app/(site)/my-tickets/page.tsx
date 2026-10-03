"use client";

import Link from "next/link";
import type { Me } from "@/lib/contracts";
import { pathFor } from "@/lib/state/journey";
import { EmptyArt, EventArt } from "@/components/illustrations";
import { PageShell } from "@/components/site/chrome";
import { fmtDate, fmtNum, fmtTime } from "@/components/site/format";
import { useMyEntries } from "@/components/site/useEvents";
import { buttonClass, StatusBadge, type Tone } from "@/components/ui";

const STATUS: Record<Me["status"], { label: string; tone: Tone; action: string }> = {
  NOT_REGISTERED: { label: "Not entered", tone: "neutral", action: "View event" },
  REGISTERED: { label: "In the pool", tone: "neutral", action: "View entry" },
  QUEUED: { label: "In the queue", tone: "live", action: "View my place" },
  ADMITTED: { label: "Your turn", tone: "live", action: "Reserve now" },
  CONFIRMED: { label: "Confirmed", tone: "success", action: "View ticket" },
  EXPIRED: { label: "Window ended", tone: "danger", action: "Details" },
  INELIGIBLE: { label: "Not eligible", tone: "danger", action: "Details" },
  SOLD_OUT: { label: "Event full", tone: "danger", action: "Details" },
};

export default function MyTickets() {
  const { data: entries, error } = useMyEntries();

  return (
    <PageShell>
      <div className="max-w-2xl">
        <div className="eyebrow">My tickets</div>
        <h1 className="display mt-4 text-[clamp(2.8rem,6vw,4.4rem)]">
          Where you <em>stand.</em>
        </h1>
        <p className="mt-5 text-lg text-muted">Every drop you&apos;ve entered, with your live status in each.</p>
      </div>

      {error && !entries ? (
        <p className="mt-12 rounded-[18px] border border-line bg-surface p-6 text-muted">
          {error.status === 401 ? "Sign in to see your entries." : "We couldn't load your entries. Retrying in the background."}
        </p>
      ) : !entries ? (
        <div className="mt-12 space-y-4" aria-busy="true">
          {[0, 1].map((i) => (
            <div key={i} className="h-36 animate-pulse rounded-[22px] bg-surface" />
          ))}
        </div>
      ) : entries.length === 0 ? (
        <div className="mx-auto mt-14 max-w-sm text-center">
          <EmptyArt className="mx-auto overflow-hidden rounded-[28px] w-64" />
          <p className="serif mt-6 text-3xl">No entries yet.</p>
          <p className="mt-2 text-muted">Join a drop and it&apos;ll show up here.</p>
          <Link href="/events" className={`${buttonClass("primary")} mt-7`}>
            Browse drops
          </Link>
        </div>
      ) : (
        <ul className="mt-12 space-y-4">
          {entries.map(({ event: e, me }) => {
            const s = STATUS[me.status];
            return (
              <li key={e.id}>
                <Link
                  href={pathFor(e.id, me)}
                  className="group grid items-center gap-5 overflow-hidden rounded-[22px] border border-line/80 bg-surface p-4 shadow-[var(--shadow-soft)] transition-transform duration-200 hover:-translate-y-0.5 sm:grid-cols-[200px_1fr_auto] sm:p-5"
                >
                  <div className="overflow-hidden rounded-[16px] bg-bg-2">
                    <EventArt category={e.category} className="aspect-[3/2] w-full" />
                  </div>
                  <div className="min-w-0 px-1">
                    <StatusBadge tone={s.tone}>{s.label}</StatusBadge>
                    <div className="serif mt-2 text-3xl font-semibold leading-tight">{e.name}</div>
                    <div className="mt-1 text-sm text-muted">
                      {fmtDate(e.starts_at)} · {fmtTime(e.starts_at)} · {e.venue}
                    </div>
                    {me.status === "QUEUED" && (
                      <div className="mt-2 text-sm">
                        Position <span className="serif num text-lg font-semibold">{fmtNum(me.position)}</span>
                      </div>
                    )}
                    {me.status === "CONFIRMED" && <div className="mt-2 text-sm">Seat {me.ticket.seat_label}</div>}
                  </div>
                  <span className={`${buttonClass(me.status === "ADMITTED" ? "primary" : "secondary", "sm")} justify-self-start sm:justify-self-end`}>
                    {s.action} <span aria-hidden>→</span>
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </PageShell>
  );
}
