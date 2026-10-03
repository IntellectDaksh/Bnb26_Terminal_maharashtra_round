"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import type { Me } from "@/lib/contracts";
import { useAuth } from "@/lib/auth";
import { pathFor } from "@/lib/state/journey";
import { ART_LABEL, EmptyArt, EventArt } from "@/components/illustrations";
import { PageShell } from "@/components/site/chrome";
import { fmtDate, fmtNum, fmtTime } from "@/components/site/format";
import { useMyEntries } from "@/components/site/useEvents";
import { buttonClass, Button, cx, StatusBadge, type Tone } from "@/components/ui";

type Segment = "all" | "queue" | "reserved" | "confirmed";

const STATUS_CONFIG: Record<Me["status"], { label: string; tone: Tone; action: string }> = {
  NOT_REGISTERED: { label: "Not entered", tone: "neutral", action: "View drop" },
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
  const { user, signIn } = useAuth();
  const [segment, setSegment] = useState<Segment>("all");

  const counts = useMemo(() => {
    if (!entries) return { all: 0, queue: 0, reserved: 0, confirmed: 0 };
    return {
      all: entries.length,
      queue: entries.filter((e) => e.me.status === "QUEUED" || e.me.status === "REGISTERED").length,
      reserved: entries.filter((e) => e.me.status === "ADMITTED").length,
      confirmed: entries.filter((e) => e.me.status === "CONFIRMED").length,
    };
  }, [entries]);

  const filteredEntries = useMemo(() => {
    if (!entries) return [];
    if (segment === "queue") {
      return entries.filter((e) => e.me.status === "QUEUED" || e.me.status === "REGISTERED");
    }
    if (segment === "reserved") {
      return entries.filter((e) => e.me.status === "ADMITTED");
    }
    if (segment === "confirmed") {
      return entries.filter((e) => e.me.status === "CONFIRMED");
    }
    return entries;
  }, [entries, segment]);

  return (
    <PageShell>
      {/* Page Header */}
      <div className="max-w-3xl">
        <div className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3.5 py-1 text-xs font-semibold uppercase tracking-wider text-emerald-800">
          <span className="size-1.5 rounded-full bg-emerald-600 pulse-dot" />
          Personal Dashboard
        </div>
        <h1 className="mt-4 text-4xl font-extrabold tracking-tight text-zinc-900 sm:text-6xl">
          Where you <span className="text-emerald-600">stand.</span>
        </h1>
        <p className="mt-4 text-lg text-zinc-600 font-light leading-relaxed">
          Track all your active drop entries, real-time queue rankings, and verified ticket passes in one central dashboard.
        </p>
      </div>

      {/* Segmented Filter Pills */}
      {entries && entries.length > 0 && (
        <div className="mt-10 flex flex-wrap items-center gap-2 border-b border-zinc-200/70 pb-4">
          {[
            { id: "all" as Segment, label: "All Drops", count: counts.all },
            { id: "queue" as Segment, label: "Active Queues", count: counts.queue },
            { id: "reserved" as Segment, label: "Reserved Seats", count: counts.reserved },
            { id: "confirmed" as Segment, label: "Confirmed Tickets", count: counts.confirmed },
          ].map((tab) => {
            const active = segment === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setSegment(tab.id)}
                className={cx(
                  "flex items-center gap-2 rounded-full px-5 py-2 text-xs font-semibold uppercase tracking-wider transition-all duration-200 cursor-pointer",
                  active
                    ? "bg-zinc-900 text-white shadow-sm"
                    : "bg-white text-zinc-600 border border-zinc-200/80 hover:border-zinc-300 hover:text-zinc-900",
                )}
              >
                <span>{tab.label}</span>
                <span
                  className={cx(
                    "rounded-full px-2 py-0.5 text-[11px] font-bold leading-none",
                    active ? "bg-emerald-500 text-white" : "bg-zinc-100 text-zinc-600",
                  )}
                >
                  {tab.count}
                </span>
              </button>
            );
          })}
        </div>
      )}

      {/* Content States */}
      <div className="mt-8">
        {error && !entries ? (
          error.status === 401 ? (
            <div className="mx-auto mt-12 max-w-md rounded-3xl border border-zinc-200/80 glass-panel p-8 text-center shadow-lg">
              <div className="grid size-12 place-items-center rounded-2xl bg-emerald-50 text-emerald-600 mx-auto">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="size-6">
                  <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                  <circle cx="12" cy="7" r="4" />
                </svg>
              </div>
              <h3 className="mt-4 text-xl font-bold text-zinc-900">Sign in to view your tickets</h3>
              <p className="mt-2 text-sm text-zinc-500 font-light leading-relaxed">
                Your drop entries, live queue positions, and confirmed tickets are securely tied to your verified account.
              </p>
              <Button
                variant="primary"
                size="lg"
                className="mt-6 w-full shadow-lg shadow-emerald-900/10"
                onClick={() => void signIn("/my-tickets")}
              >
                Sign in with Google
              </Button>
            </div>
          ) : (
            <div className="rounded-3xl border border-red-200 bg-red-50/50 p-8 text-center text-red-700">
              <p className="font-semibold">Unable to load ticket entries.</p>
              <p className="mt-1 text-xs text-red-500 font-light">Retrying in the background...</p>
            </div>
          )
        ) : !entries ? (
          <div className="space-y-4" aria-busy="true">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-44 animate-pulse rounded-3xl border border-zinc-200/60 bg-white" />
            ))}
          </div>
        ) : entries.length === 0 ? (
          <div className="mx-auto mt-14 max-w-md text-center">
            <EmptyArt className="mx-auto w-64 overflow-hidden rounded-3xl" />
            <h3 className="mt-6 text-2xl font-bold text-zinc-900">No entries yet</h3>
            <p className="mt-2 text-sm text-zinc-500 font-light">
              You haven&apos;t joined any drops yet. Explore upcoming drops on the calendar and enter a pool.
            </p>
            <div className="mt-6">
              <Link href="/events" className={cx(buttonClass("primary", "lg"), "shadow-lg shadow-emerald-900/15")}>
                Browse upcoming drops →
              </Link>
            </div>
          </div>
        ) : filteredEntries.length === 0 ? (
          <div className="rounded-3xl border border-zinc-200/80 bg-white p-12 text-center">
            <p className="text-lg font-semibold text-zinc-800">No drops in this category</p>
            <p className="mt-1 text-xs text-zinc-500 font-light">
              You don&apos;t currently have any events matching the selected &quot;{segment}&quot; filter.
            </p>
            <Button variant="secondary" className="mt-4" onClick={() => setSegment("all")}>
              Show all drops
            </Button>
          </div>
        ) : (
          <ul className="space-y-4">
            {filteredEntries.map(({ event: e, me }) => {
              const statusCfg = STATUS_CONFIG[me.status];
              const isAdmitted = me.status === "ADMITTED";
              const isConfirmed = me.status === "CONFIRMED";
              const isQueued = me.status === "QUEUED";

              return (
                <li key={e.id}>
                  <Link
                    href={pathFor(e.id, me)}
                    className={cx(
                      "group grid items-center gap-6 overflow-hidden rounded-3xl border bg-white p-5 shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:shadow-xl sm:grid-cols-[220px_1fr_auto] sm:p-6",
                      isAdmitted
                        ? "border-emerald-500 bg-gradient-to-r from-emerald-50/50 via-white to-white shadow-emerald-900/10"
                        : "border-zinc-200/80 hover:border-emerald-500/30",
                    )}
                  >
                    {/* Event Art */}
                    <div className="relative aspect-[16/10] overflow-hidden rounded-2xl bg-zinc-100">
                      <EventArt category={e.category} className="size-full object-cover transition-transform duration-500 group-hover:scale-105" />
                      <div className="absolute top-2.5 left-2.5">
                        <span className="glass-panel rounded-full px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-zinc-800 shadow-sm border border-white/60">
                          {ART_LABEL[e.category]}
                        </span>
                      </div>
                    </div>

                    {/* Middle Info */}
                    <div className="min-w-0 space-y-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <StatusBadge tone={statusCfg.tone}>{statusCfg.label}</StatusBadge>
                        {isAdmitted && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-600 px-2.5 py-0.5 text-[10px] font-bold text-white shadow-sm">
                            <span className="size-1.5 rounded-full bg-white pulse-dot" />
                            5-Minute Window Active
                          </span>
                        )}
                      </div>

                      <h3 className="text-xl sm:text-2xl font-bold tracking-tight text-zinc-900 group-hover:text-emerald-700 transition-colors truncate">
                        {e.name}
                      </h3>

                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-zinc-500 font-light">
                        <span>{fmtDate(e.starts_at)} · {fmtTime(e.starts_at)} IST</span>
                        <span>·</span>
                        <span>{e.venue}, {e.city}</span>
                      </div>

                      {/* State Details */}
                      {isQueued && (
                        <div className="mt-2 inline-flex items-center gap-2 rounded-xl bg-zinc-50 border border-zinc-100 px-3 py-1.5 text-xs text-zinc-700">
                          <span className="font-light text-zinc-500">Queue position:</span>
                          <span className="num font-bold text-zinc-900">#{fmtNum(me.position)}</span>
                          <span className="text-zinc-400">of {fmtNum(me.total)}</span>
                          {me.admitted_ahead !== undefined && (
                            <span className="text-emerald-600 font-medium">({me.admitted_ahead} admitted ahead)</span>
                          )}
                        </div>
                      )}

                      {isConfirmed && (
                        <div className="mt-2 inline-flex items-center gap-3 rounded-xl bg-emerald-50 border border-emerald-200/60 px-3.5 py-1.5 text-xs text-emerald-900">
                          <span className="font-semibold">Seat: {me.ticket.seat_label}</span>
                          <span className="text-emerald-600">·</span>
                          <span className="text-emerald-700">Holder: {me.ticket.holder_name}</span>
                          <span className="text-emerald-600">·</span>
                          <span className="text-emerald-600 font-mono text-[11px]">#{me.ticket.ticket_id.slice(0, 8)}</span>
                        </div>
                      )}

                      {me.status === "REGISTERED" && (
                        <div className="mt-2 inline-flex items-center gap-2 rounded-xl bg-zinc-50 border border-zinc-100 px-3 py-1.5 text-xs text-zinc-600">
                          <span className="size-1.5 rounded-full bg-zinc-400" />
                          <span>In registration pool · Awaiting random shuffle draw</span>
                        </div>
                      )}
                    </div>

                    {/* Action Button */}
                    <div className="justify-self-start sm:justify-self-end">
                      <span
                        className={cx(
                          buttonClass(isAdmitted ? "primary" : "secondary", "sm"),
                          isAdmitted && "shadow-md shadow-emerald-900/15",
                        )}
                      >
                        {statusCfg.action} <span aria-hidden>→</span>
                      </span>
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </PageShell>
  );
}
