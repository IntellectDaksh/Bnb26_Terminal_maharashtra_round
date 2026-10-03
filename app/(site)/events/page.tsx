"use client";

import { useMemo, useState } from "react";
import { EventCategory, type Phase } from "@/lib/contracts";
import { ART_LABEL, EmptyArt } from "@/components/illustrations";
import { PageShell } from "@/components/site/chrome";
import { EventCard, EventCardSkeleton } from "@/components/site/EventCard";
import { PHASE_ORDER } from "@/components/site/format";
import { useEvents } from "@/components/site/useEvents";
import { Button, cx } from "@/components/ui";

const STATUS: { id: string; label: string; phases: Phase[] }[] = [
  { id: "all", label: "All", phases: [] },
  { id: "open", label: "Open now", phases: ["REGISTRATION_OPEN"] },
  { id: "live", label: "Live drop", phases: ["ADMITTING"] },
  { id: "soon", label: "Starting soon", phases: ["REGISTRATION_CLOSED", "QUEUE_READY"] },
  { id: "sold", label: "Sold out", phases: ["SOLD_OUT", "ENDED"] },
];

const chip = (on: boolean) =>
  cx(
    "h-10 rounded-full border px-4 text-sm font-semibold transition-colors",
    on ? "border-fg bg-fg text-white" : "border-line bg-surface text-muted hover:border-accent/50 hover:text-fg",
  );

export default function Events() {
  const { data: events, error } = useEvents();
  const [q, setQ] = useState("");
  const [cat, setCat] = useState<string>("all");
  const [status, setStatus] = useState("all");
  const [city, setCity] = useState("all");

  const cities = useMemo(() => [...new Set(events?.map((e) => e.city) ?? [])].sort(), [events]);
  const shown = useMemo(() => {
    const phases = STATUS.find((s) => s.id === status)!.phases;
    const needle = q.trim().toLowerCase();
    return (events ?? [])
      .filter((e) => cat === "all" || e.category === cat)
      .filter((e) => city === "all" || e.city === city)
      .filter((e) => !phases.length || phases.includes(e.phase))
      .filter((e) => !needle || `${e.name} ${e.tagline} ${e.organizer} ${e.venue}`.toLowerCase().includes(needle))
      .sort((a, b) => PHASE_ORDER[a.phase] - PHASE_ORDER[b.phase] || a.starts_at.localeCompare(b.starts_at));
  }, [events, q, cat, status, city]);

  const clear = () => {
    setQ("");
    setCat("all");
    setStatus("all");
    setCity("all");
  };

  return (
    <PageShell>
      <div className="max-w-2xl">
        <div className="eyebrow">Events</div>
        <h1 className="display mt-4 text-[clamp(2.8rem,6vw,4.6rem)]">
          Every <em>drop</em>, one place.
        </h1>
        <p className="mt-5 text-lg text-muted">Pick an event and join its pool. Each one runs its own fair drop, so entering one never affects another.</p>
      </div>

      <div className="mt-12 space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row">
          <label className="relative flex-1">
            <span className="sr-only">Search events</span>
            <svg viewBox="0 0 20 20" className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-muted" aria-hidden>
              <circle cx="9" cy="9" r="6" stroke="currentColor" strokeWidth="1.6" fill="none" />
              <path d="M14 14l4 4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
            </svg>
            <input
              type="search"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search events, venues, organizers"
              className="h-12 w-full rounded-full border border-line bg-surface pl-11 pr-5 text-[15px] focus:border-accent focus:outline-none"
            />
          </label>
          <label className="relative sm:w-56">
            <span className="sr-only">City</span>
            <select
              value={city}
              onChange={(e) => setCity(e.target.value)}
              className="h-12 w-full appearance-none rounded-full border border-line bg-surface pl-5 pr-10 text-[15px] focus:border-accent focus:outline-none"
            >
              <option value="all">All cities</option>
              {cities.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
            <svg viewBox="0 0 16 16" className="pointer-events-none absolute right-4 top-1/2 size-4 -translate-y-1/2 text-muted" aria-hidden>
              <path d="M4 6l4 4 4-4" stroke="currentColor" strokeWidth="1.5" fill="none" />
            </svg>
          </label>
        </div>
        <div className="flex flex-wrap gap-2" role="group" aria-label="Status">
          {STATUS.map((s) => (
            <button key={s.id} className={chip(status === s.id)} aria-pressed={status === s.id} onClick={() => setStatus(s.id)}>
              {s.label}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap gap-2" role="group" aria-label="Category">
          {["all", ...EventCategory.options].map((c) => (
            <button key={c} className={chip(cat === c)} aria-pressed={cat === c} onClick={() => setCat(c)}>
              {c === "all" ? "All types" : ART_LABEL[c as EventCategory]}
            </button>
          ))}
        </div>
      </div>

      {error && !events ? (
        <p className="mt-12 rounded-[18px] border border-line bg-surface p-6 text-muted">We couldn&apos;t load events right now. Retrying in the background.</p>
      ) : !events ? (
        <div className="mt-12 grid gap-7 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }, (_, i) => (
            <EventCardSkeleton key={i} />
          ))}
        </div>
      ) : shown.length ? (
        <>
          <p className="mt-10 text-sm text-muted" aria-live="polite">
            {shown.length} {shown.length === 1 ? "event" : "events"}
          </p>
          <div className="mt-4 grid gap-7 sm:grid-cols-2 lg:grid-cols-3">
            {shown.map((e) => (
              <EventCard key={e.id} event={e} />
            ))}
          </div>
        </>
      ) : (
        <div className="mx-auto mt-16 max-w-sm text-center">
          <EmptyArt className="mx-auto overflow-hidden rounded-[28px] w-64" />
          <p className="serif mt-6 text-2xl">Nothing matches those filters.</p>
          <Button variant="secondary" className="mt-6" onClick={clear}>
            Clear filters
          </Button>
        </div>
      )}
    </PageShell>
  );
}
