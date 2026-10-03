"use client";

import { useCallback } from "react";
import { api, ApiError } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { useJourney } from "@/lib/state/JourneyProvider";
import { EventArt } from "@/components/illustrations";
import { LoadState, PageShell, RestoredNote, useRouteGuard } from "@/components/site/chrome";
import { fmtDate, fmtPrice, fmtTime } from "@/components/site/format";
import { errorCopy, stableKey, useAction } from "@/components/site/useAction";
import { cx, useCountdown } from "@/components/ui";

export default function Reservation() {
  const me = useRouteGuard("reservation");
  const { event, eventId, setMe, refresh } = useJourney();
  const { user } = useAuth();
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
  
  const total = Math.ceil(Math.max(0, ms) / 1000);
  const mm = String(Math.floor(total / 60)).padStart(2, "0");
  const ss = String(total % 60).padStart(2, "0");
  const urgent = ms < 60_000;
  const windowMs = event.reservation_window_s * 1000;
  const holdMinutes = Math.max(1, Math.round(event.reservation_window_s / 60));
  const attendeeName = user?.name || "Verified Attendee";

  return (
    <PageShell className="pt-8 sm:pt-10">
      <div className="mx-auto max-w-5xl">
        <div className="grid gap-10 lg:grid-cols-[1.1fr_1fr] lg:gap-14 items-start">
          {/* Left: High-Urgency Callout & Prominent Countdown Clock */}
          <div className="rise">
            <div className="flex flex-wrap items-center gap-3">
              <span className="eyebrow">Admitted Entrant</span>
              <RestoredNote>Reservation restored</RestoredNote>
            </div>

            <h1 className="display mt-4 text-[clamp(2.8rem,6.5vw,5rem)]">
              It&apos;s your <em className="accent-italic">turn.</em>
            </h1>
            <p className="mt-3 text-base text-zinc-600 leading-relaxed max-w-md">
              A seat has been reserved exclusively for you. Confirm your ticket before the countdown expires, or it will be released to the next person in line.
            </p>

            {/* Countdown Clock Container */}
            <div
              className={cx(
                "mt-8 rounded-3xl border p-8 shadow-xl transition-all duration-300",
                urgent
                  ? "border-red-300 bg-red-50/70 shadow-red-900/10 ring-2 ring-red-400/30"
                  : "border-zinc-200/80 bg-white shadow-emerald-900/5"
              )}
              role="timer"
              aria-label={`${Math.floor(total / 60)} minutes ${total % 60} seconds remaining`}
            >
              <div className="flex items-center justify-between">
                <span
                  className={cx(
                    "text-xs font-bold uppercase tracking-wider",
                    urgent ? "text-red-700 animate-pulse" : "text-emerald-700"
                  )}
                >
                  {urgent ? "⚠️ Hold Expiring Soon" : "Exclusive Hold Window"}
                </span>
                <span className="text-xs text-zinc-500 font-medium">Server Synchronized</span>
              </div>

              {/* Large Tabular Digits */}
              <div
                className={cx(
                  "num flex items-baseline justify-center sm:justify-start gap-2 text-[clamp(4.8rem,13vw,7.5rem)] font-bold leading-none tracking-tight my-4 transition-colors duration-300",
                  urgent ? "text-red-600 animate-pulse" : "text-zinc-900"
                )}
              >
                <span>{mm}</span>
                <span className={cx("-translate-y-[0.06em]", urgent ? "text-red-400" : "text-emerald-600")} aria-hidden>
                  :
                </span>
                <span>{ss}</span>
              </div>

              {/* Progress Bar for Window */}
              <div className="h-2 w-full overflow-hidden rounded-full bg-zinc-100" aria-hidden>
                <div
                  className={cx(
                    "h-full rounded-full transition-[width] duration-300 ease-linear",
                    urgent ? "bg-red-500 animate-pulse" : "bg-gradient-to-r from-emerald-500 to-emerald-600"
                  )}
                  style={{ width: `${Math.min(1, ms / windowMs) * 100}%` }}
                />
              </div>

              <div className="mt-3 flex items-center justify-between text-xs text-zinc-500">
                <span>Minutes : Seconds Remaining</span>
                <span>Expires at {fmtTime(admitted.expires_at)}</span>
              </div>
            </div>

            {/* Reassurance Callout */}
            <div className="mt-6 rounded-2xl border border-zinc-200/80 bg-zinc-50/80 p-4 text-xs leading-relaxed text-zinc-600 flex items-start gap-2.5">
              <span className="text-emerald-600 text-sm mt-0.5">🔒</span>
              <div>
                <strong className="text-zinc-900">Guaranteed Seat Hold:</strong> No other participant can claim this seat while your timer is running. It is locked to your account on the server.
              </div>
            </div>
          </div>

          {/* Right: Seat Reservation Summary Card */}
          <div className="rise">
            <article className="overflow-hidden rounded-3xl border border-zinc-200/80 bg-white shadow-xl shadow-emerald-900/5">
              <div className="overflow-hidden border-b border-zinc-100 bg-zinc-50">
                <EventArt category={event.category} className="aspect-[3/2] w-full" />
              </div>

              <div className="p-7 sm:p-8">
                <div className="flex items-center justify-between">
                  <span className="eyebrow">Reservation Summary</span>
                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-0.5 text-[11px] font-bold text-emerald-700 border border-emerald-200/60">
                    1 Seat Held
                  </span>
                </div>

                <h2 className="serif text-2xl font-bold text-zinc-900 mt-2">{event.name}</h2>
                <p className="mt-1 text-sm text-zinc-500">{event.venue}, {event.city}</p>

                {/* Seat Reservation Details: Category, Attendee, Held Hold Time */}
                <dl className="mt-6 divide-y divide-zinc-100 rounded-2xl border border-zinc-100 bg-zinc-50/60 p-4 text-xs">
                  <div className="flex items-center justify-between py-2">
                    <dt className="text-zinc-500">Seat Category</dt>
                    <dd className="font-semibold text-zinc-900">General Admission (1 Ticket)</dd>
                  </div>
                  <div className="flex items-center justify-between py-2">
                    <dt className="text-zinc-500">Attendee Name</dt>
                    <dd className="font-semibold text-zinc-900">{attendeeName}</dd>
                  </div>
                  <div className="flex items-center justify-between py-2">
                    <dt className="text-zinc-500">Held Hold Time</dt>
                    <dd className="font-semibold text-emerald-700">{holdMinutes} min (until {fmtTime(admitted.expires_at)})</dd>
                  </div>
                  <div className="flex items-center justify-between py-2">
                    <dt className="text-zinc-500">Event Date</dt>
                    <dd className="font-semibold text-zinc-900">{fmtDate(event.starts_at)}, {fmtTime(event.starts_at)}</dd>
                  </div>
                  <div className="flex items-center justify-between py-2 pt-2.5 text-sm">
                    <dt className="font-medium text-zinc-700">Total Price</dt>
                    <dd className="font-bold text-zinc-900">{fmtPrice(event.price_inr)}</dd>
                  </div>
                </dl>

                {/* Single-action high-contrast CTA */}
                <button
                  type="button"
                  disabled={action.blocked || ms <= 0}
                  onClick={() => void action.run()}
                  className={cx(
                    "mt-7 w-full bg-emerald-600 hover:bg-emerald-700 text-white font-semibold py-4 px-6 rounded-xl shadow-lg shadow-emerald-900/10 transition-all duration-200 flex items-center justify-center gap-2 text-base active:scale-[0.99] disabled:opacity-40 disabled:cursor-not-allowed",
                    action.pending && "cursor-wait"
                  )}
                >
                  {action.pending ? (
                    <>
                      <span className="size-4 animate-spin rounded-full border-2 border-white border-r-transparent" aria-hidden />
                      <span>Claiming Ticket...</span>
                    </>
                  ) : action.retryIn > 0 ? (
                    `Try again in ${action.retryIn}s`
                  ) : (
                    <>
                      <span>Confirm and Claim Ticket</span>
                      <span aria-hidden>→</span>
                    </>
                  )}
                </button>

                {action.error && action.error.status !== 409 && (
                  <p role="alert" className="mt-4 text-center text-sm font-medium text-red-600">
                    {errorCopy(action.error, action.retryIn)}
                  </p>
                )}

                <p className="mt-4 text-center text-xs text-zinc-500">
                  Protected by idempotent transaction key. Confirming multiple times will never duplicate your ticket.
                </p>
              </div>
            </article>
          </div>
        </div>
      </div>
    </PageShell>
  );
}
