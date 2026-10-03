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
  { id: "all", label: "All Statuses", phases: [] },
  { id: "open", label: "Open Now", phases: ["REGISTRATION_OPEN"] },
  { id: "live", label: "Live Drop", phases: ["ADMITTING"] },
  { id: "soon", label: "Starting Soon", phases: ["REGISTRATION_CLOSED", "QUEUE_READY"] },
  { id: "sold", label: "Sold Out", phases: ["SOLD_OUT", "ENDED"] },
];

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
      {/* Header with Title and Narrative */}
      <div className="max-w-3xl">
        <div className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3.5 py-1 text-xs font-semibold uppercase tracking-wider text-emerald-800">
          <span className="size-1.5 rounded-full bg-emerald-600 pulse-dot" />
          Live Catalog
        </div>
        <h1 className="mt-4 text-4xl font-extrabold tracking-tight text-zinc-900 sm:text-6xl">
          Every <span className="text-emerald-600">drop</span>, one place.
        </h1>
        <p className="mt-4 text-lg text-zinc-600 font-light leading-relaxed">
          Select an event to join its fair admission pool. Each event manages its own cryptographically isolated queue, ensuring entering one never affects your position in another.
        </p>
      </div>

      {/* Floating Search & Filter Bar */}
      <div className="mt-10 space-y-5">
        <div className="glass-panel rounded-3xl border border-zinc-200/80 p-3 sm:p-4 shadow-sm backdrop-blur-xl">
          <div className="flex flex-col gap-3 sm:flex-row">
            {/* Search Input using .form-input */}
            <div className="relative flex-1">
              <span className="sr-only">Search events</span>
              <svg
                viewBox="0 0 20 20"
                className="pointer-events-none absolute left-4 top-1/2 size-4.5 -translate-y-1/2 text-zinc-400"
                aria-hidden
              >
                <circle cx="9" cy="9" r="6" stroke="currentColor" strokeWidth="1.8" fill="none" />
                <path d="M14 14l4 4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
              </svg>
              <input
                type="search"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search by event title, venue, organizer..."
                className="form-input pl-11 pr-10 h-12 bg-white"
              />
              {q && (
                <button
                  type="button"
                  onClick={() => setQ("")}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs font-semibold text-zinc-400 hover:text-zinc-600"
                  aria-label="Clear search"
                >
                  ✕
                </button>
              )}
            </div>

            {/* City Select */}
            <div className="relative sm:w-56">
              <span className="sr-only">City</span>
              <select
                value={city}
                onChange={(e) => setCity(e.target.value)}
                className="form-input h-12 appearance-none pl-4 pr-10 bg-white"
              >
                <option value="all">All Cities</option>
                {cities.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
              <svg
                viewBox="0 0 16 16"
                className="pointer-events-none absolute right-4 top-1/2 size-4 -translate-y-1/2 text-zinc-400"
                aria-hidden
              >
                <path d="M4 6l4 4 4-4" stroke="currentColor" strokeWidth="1.5" fill="none" />
              </svg>
            </div>
          </div>
        </div>

        {/* Category Pill Filters (All, Hackathon, Concert, Film, Conference, Comedy, Workshop, Sports) */}
        <div>
          <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Event Categories">
            <button
              onClick={() => setCat("all")}
              aria-pressed={cat === "all"}
              className={cx(
                "h-10 rounded-full px-5 text-xs font-semibold uppercase tracking-wider transition-all duration-200 cursor-pointer",
                cat === "all"
                  ? "bg-emerald-600 text-white shadow-md shadow-emerald-900/10 border border-emerald-600"
                  : "bg-white text-zinc-600 border border-zinc-200/80 hover:border-emerald-500/30 hover:text-zinc-900",
              )}
            >
              All Categories
            </button>
            {EventCategory.options.map((c) => {
              const active = cat === c;
              return (
                <button
                  key={c}
                  onClick={() => setCat(c)}
                  aria-pressed={active}
                  className={cx(
                    "h-10 rounded-full px-5 text-xs font-semibold uppercase tracking-wider transition-all duration-200 cursor-pointer",
                    active
                      ? "bg-emerald-600 text-white shadow-md shadow-emerald-900/10 border border-emerald-600"
                      : "bg-white text-zinc-600 border border-zinc-200/80 hover:border-emerald-500/30 hover:text-zinc-900",
                  )}
                >
                  {ART_LABEL[c as EventCategory]}
                </button>
              );
            })}
          </div>
        </div>

        {/* Status Pill Filters */}
        <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Drop Status">
          {STATUS.map((s) => {
            const active = status === s.id;
            return (
              <button
                key={s.id}
                onClick={() => setStatus(s.id)}
                aria-pressed={active}
                className={cx(
                  "h-8.5 rounded-full px-4 text-xs font-medium transition-all duration-200 cursor-pointer",
                  active
                    ? "bg-zinc-900 text-white shadow-sm"
                    : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200 hover:text-zinc-900",
                )}
              >
                {s.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Results Section */}
      <div className="mt-10">
        {error && !events ? (
          <div className="rounded-3xl border border-red-200 bg-red-50/50 p-8 text-center text-red-700">
            <p className="font-semibold">Unable to load event drops right now.</p>
            <p className="mt-1 text-xs text-red-500 font-light">Retrying connection automatically in the background...</p>
          </div>
        ) : !events ? (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }, (_, i) => (
              <EventCardSkeleton key={i} />
            ))}
          </div>
        ) : shown.length > 0 ? (
          <div>
            <div className="mb-6 flex items-center justify-between text-xs text-zinc-500 font-light">
              <span>
                Showing <strong className="font-semibold text-zinc-800">{shown.length}</strong> {shown.length === 1 ? "drop" : "drops"}
              </span>
              {(cat !== "all" || status !== "all" || city !== "all" || q) && (
                <button
                  onClick={clear}
                  className="font-medium text-emerald-600 hover:text-emerald-700 hover:underline cursor-pointer"
                >
                  Reset all filters
                </button>
              )}
            </div>
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {shown.map((e) => (
                <EventCard key={e.id} event={e} />
              ))}
            </div>
          </div>
        ) : (
          <div className="mx-auto mt-16 max-w-sm text-center">
            <EmptyArt className="mx-auto w-64 overflow-hidden rounded-3xl" />
            <h3 className="mt-6 text-2xl font-bold text-zinc-900">No matching drops</h3>
            <p className="mt-2 text-sm text-zinc-500 font-light">
              No events matched your current search and filter criteria. Try clearing filters to see all available drops.
            </p>
            <Button variant="secondary" className="mt-6" onClick={clear}>
              Clear all filters
            </Button>
          </div>
        )}
      </div>
    </PageShell>
  );
}
