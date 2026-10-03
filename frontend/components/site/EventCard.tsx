import Link from "next/link";
import type { EventInfo } from "@/lib/contracts";
import { eventPath } from "@/lib/state/journey";
import { ART_LABEL, EventArt } from "@/components/illustrations";
import { cx, ProgressBar, StatusBadge } from "@/components/ui";
import { fmtDate, fmtNum, fmtPrice, fmtTime, PHASE_COPY, seatsLeft } from "./format";

export function EventCard({ event: e, className }: { event: EventInfo; className?: string }) {
  const phase = PHASE_COPY[e.phase];
  const live = e.phase === "ADMITTING";
  return (
    <Link
      href={eventPath(e.id)}
      className={cx(
        "group flex flex-col overflow-hidden rounded-3xl border border-zinc-200/80 bg-white shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-xl hover:shadow-emerald-900/5 hover:border-emerald-500/30",
        className,
      )}
    >
      <div className="relative aspect-[16/10] overflow-hidden bg-zinc-100">
        <EventArt category={e.category} className="size-full object-cover transition-transform duration-500 group-hover:scale-105" />
        <div className="absolute inset-0 bg-gradient-to-t from-zinc-950/60 via-transparent to-transparent"></div>
        <div className="absolute left-4 top-4 flex gap-2">
          <span className="rounded-full bg-white/90 backdrop-blur-md px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-zinc-800 shadow-sm">
            {ART_LABEL[e.category]}
          </span>
        </div>
        <div className="absolute right-4 top-4">
          <StatusBadge tone={phase.tone} className="bg-white/95 backdrop-blur-md shadow-sm">
            {phase.short}
          </StatusBadge>
        </div>
        <div className="absolute bottom-3 left-4 right-4 flex justify-between items-baseline text-white">
          <span className="text-xs font-light text-zinc-200">{e.city}</span>
          <span className="text-xs font-semibold uppercase tracking-wider text-emerald-400">{fmtPrice(e.price_inr)}</span>
        </div>
      </div>
      <div className="flex flex-1 flex-col p-6">
        <div className="text-xs font-medium text-emerald-600 uppercase tracking-wider">
          {fmtDate(e.starts_at)} · {fmtTime(e.starts_at)}
        </div>
        <h3 className="mt-2 text-xl font-semibold tracking-tight text-zinc-900 group-hover:text-emerald-700 transition-colors">{e.name}</h3>
        <p className="mt-2 line-clamp-2 text-sm text-zinc-500 font-light leading-relaxed">{e.tagline}</p>
        <div className="mt-auto pt-6">
          {live ? (
            <div className="space-y-2">
              <ProgressBar value={e.seats_confirmed / e.seats_total} label={`${e.name} seats confirmed`} tone="success" />
              <div className="flex justify-between text-xs text-zinc-500 font-light">
                <span>
                  <strong className="num font-semibold text-zinc-900">{fmtNum(seatsLeft(e))}</strong> seats left
                </span>
                <span className="text-emerald-600 font-medium">Admission Live</span>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-between border-t border-zinc-100 pt-4 text-xs text-zinc-500 font-light">
              <span>
                <strong className="num font-semibold text-zinc-900">{fmtNum(e.seats_total)}</strong> total seats
              </span>
              <span className="text-zinc-600">
                <strong className="num font-semibold text-zinc-900">{fmtNum(e.registrations)}</strong> in pool
              </span>
            </div>
          )}
        </div>
      </div>
    </Link>
  );
}

export function EventCardSkeleton() {
  return (
    <div className="overflow-hidden rounded-3xl border border-zinc-200/80 bg-white shadow-sm" aria-hidden>
      <div className="aspect-[16/10] animate-pulse bg-zinc-100" />
      <div className="space-y-3 p-6">
        <div className="h-3 w-1/3 animate-pulse rounded-full bg-zinc-100" />
        <div className="h-6 w-2/3 animate-pulse rounded-full bg-zinc-100" />
        <div className="h-4 w-full animate-pulse rounded-full bg-zinc-100" />
      </div>
    </div>
  );
}
