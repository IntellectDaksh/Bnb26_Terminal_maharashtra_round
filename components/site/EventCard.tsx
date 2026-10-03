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
        "group flex flex-col overflow-hidden rounded-[22px] border border-line/80 bg-surface shadow-[var(--shadow-soft)] transition-[transform,box-shadow] duration-300 hover:-translate-y-1 hover:shadow-[0_28px_50px_-30px_rgba(122,82,44,0.45)]",
        className,
      )}
    >
      <div className="relative aspect-[3/2] overflow-hidden bg-bg-2">
        <EventArt category={e.category} className="size-full transition-transform duration-500 group-hover:scale-[1.03]" />
        <div className="absolute left-4 top-4 flex gap-2">
          <span className="rounded-full bg-surface/90 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.14em] text-fg backdrop-blur">
            {ART_LABEL[e.category]}
          </span>
        </div>
        <div className="absolute right-4 top-4">
          <StatusBadge tone={phase.tone} className="bg-surface/90 backdrop-blur">
            {phase.short}
          </StatusBadge>
        </div>
      </div>
      <div className="flex flex-1 flex-col p-6">
        <div className="text-[13px] font-semibold text-muted">
          {fmtDate(e.starts_at)} · {fmtTime(e.starts_at)} · {e.city}
        </div>
        <h3 className="serif mt-2 text-[28px] font-semibold leading-[1.05]">{e.name}</h3>
        <p className="mt-2 line-clamp-2 text-[15px] leading-relaxed text-muted">{e.tagline}</p>
        <div className="mt-auto pt-6">
          {live ? (
            <>
              <ProgressBar value={e.seats_confirmed / e.seats_total} label={`${e.name} seats confirmed`} />
              <div className="mt-2 flex justify-between text-[13px] text-muted">
                <span>
                  <span className="num font-semibold text-fg">{fmtNum(seatsLeft(e))}</span> seats left
                </span>
                <span className="font-semibold text-fg">{fmtPrice(e.price_inr)}</span>
              </div>
            </>
          ) : (
            <div className="flex items-center justify-between border-t border-line pt-4 text-[13px] text-muted">
              <span>
                <span className="num font-semibold text-fg">{fmtNum(e.seats_total)}</span> seats ·{" "}
                <span className="num">{fmtNum(e.registrations)}</span> in pool
              </span>
              <span className="text-[15px] font-bold text-fg">{fmtPrice(e.price_inr)}</span>
            </div>
          )}
        </div>
      </div>
    </Link>
  );
}

export function EventCardSkeleton() {
  return (
    <div className="overflow-hidden rounded-[22px] border border-line/80 bg-surface" aria-hidden>
      <div className="aspect-[3/2] animate-pulse bg-bg-2" />
      <div className="space-y-3 p-6">
        <div className="h-3 w-1/3 animate-pulse rounded-full bg-bg-2" />
        <div className="h-7 w-2/3 animate-pulse rounded-full bg-bg-2" />
        <div className="h-3 w-full animate-pulse rounded-full bg-bg-2" />
      </div>
    </div>
  );
}
