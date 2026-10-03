"use client";

import { useCallback } from "react";
import { api, ApiError } from "@/lib/api";
import { useJourney } from "@/lib/state/JourneyProvider";
import { EventArt } from "@/components/illustrations";
import { LoadState, PageShell, RestoredNote, useRouteGuard } from "@/components/site/chrome";
import { fmtDate, fmtPrice, fmtTime } from "@/components/site/format";
import { errorCopy, stableKey, useAction } from "@/components/site/useAction";
import { Button, cx, useCountdown } from "@/components/ui";

export default function Reservation() {
  const me = useRouteGuard("reservation");
  const { event, eventId, setMe, refresh } = useJourney();
  const admitted = me?.status === "ADMITTED" ? me : undefined;

  // when the server window ends, ask /me what happened rather than assuming
  const ms = useCountdown(admitted?.expires_at, useCallback(() => void refresh(), [refresh]));

  const confirm = useCallback(async () => {
    if (!admitted) return;
    try {
      setMe(await api.confirm(eventId, admitted.reservation_id, stableKey(`confirm.${eventId}.${admitted.reservation_id}`)));
    } catch (e) {
      if (e instanceof ApiError && e.status === 409) await refresh(); // expired or confirmed in another tab
      throw e;
    }
  }, [admitted, setMe, refresh, eventId]);
  const action = useAction(confirm);

  if (!admitted || !event) return <LoadState route="reservation" />;
  const total = Math.ceil(ms / 1000);
  const mm = String(Math.floor(total / 60)).padStart(2, "0");
  const ss = String(total % 60).padStart(2, "0");
  const urgent = ms < 60_000;
  const windowMs = event.reservation_window_s * 1000;

  return (
    <PageShell>
      <div className="grid gap-12 lg:grid-cols-[1.1fr_1fr] lg:gap-20">
        <div className="rise">
          <div className="flex flex-wrap items-center gap-3">
            <span className="eyebrow">You&apos;ve been admitted</span>
            <RestoredNote>Reservation restored</RestoredNote>
          </div>
          <h1 className="display mt-6 text-[clamp(3.2rem,8vw,6.4rem)]">
            It&apos;s your
            <br />
            <em>turn.</em>
          </h1>
          <p className="mt-6 max-w-md text-lg text-muted">One seat is held for you. Confirm it before the timer runs out, or it goes to the next person in line.</p>

          <div className="mt-12" role="timer" aria-label={`${Math.floor(total / 60)} minutes ${total % 60} seconds left`}>
            <div className={cx("serif num flex items-baseline gap-3 text-[clamp(5rem,14vw,8.5rem)] font-semibold leading-none transition-colors duration-300", urgent && "text-danger")}>
              <span>{mm}</span>
              <span className="-translate-y-[0.06em] text-accent-2" aria-hidden>
                :
              </span>
              <span>{ss}</span>
            </div>
            <div className="mt-4 h-1.5 max-w-md overflow-hidden rounded-full bg-line" aria-hidden>
              <div
                className={cx("h-full rounded-full transition-[width] duration-300 ease-linear", urgent ? "bg-danger" : "bg-gradient-to-r from-accent-2 to-accent")}
                style={{ width: `${Math.min(1, ms / windowMs) * 100}%` }}
              />
            </div>
            <div className="mt-3 text-[13px] text-muted">minutes · seconds left, kept in sync with the server</div>
          </div>
        </div>

        <div className="flex flex-col justify-end">
          <article className="overflow-hidden rounded-[26px] border border-line/80 bg-surface shadow-[var(--shadow-soft)]">
            <EventArt category={event.category} className="aspect-[3/2] w-full" />
            <div className="p-7 sm:p-9">
              <h2 className="serif text-3xl font-semibold">{event.name}</h2>
              <p className="mt-1 text-muted">General admission · 1 seat</p>
              <dl className="mt-7 grid grid-cols-3 gap-4 border-t border-line pt-6 text-sm">
                <div>
                  <dt className="text-muted">Date</dt>
                  <dd className="mt-1 font-semibold">
                    {fmtDate(event.starts_at)}, {fmtTime(event.starts_at)}
                  </dd>
                </div>
                <div>
                  <dt className="text-muted">Venue</dt>
                  <dd className="mt-1 font-semibold">{event.venue}</dd>
                </div>
                <div>
                  <dt className="text-muted">Price</dt>
                  <dd className="mt-1 font-semibold">{fmtPrice(event.price_inr)}</dd>
                </div>
              </dl>
              <Button size="lg" className="mt-8 w-full" onClick={() => void action.run()} loading={action.pending} disabled={action.blocked || ms <= 0}>
                {action.pending ? (
                  "Reserving"
                ) : action.retryIn > 0 ? (
                  `Try again in ${action.retryIn}s`
                ) : (
                  <>
                    Reserve my seat <span aria-hidden>→</span>
                  </>
                )}
              </Button>
              {action.error && action.error.status !== 409 && (
                <p role="alert" className="mt-4 text-sm text-danger">
                  {errorCopy(action.error, action.retryIn)}
                </p>
              )}
            </div>
          </article>
          <p className="mt-5 text-[13px] leading-relaxed text-muted">
            If you don&apos;t confirm in time, your spot is released. Pressing twice is safe, you&apos;ll get one seat.
          </p>
        </div>
      </div>
    </PageShell>
  );
}
