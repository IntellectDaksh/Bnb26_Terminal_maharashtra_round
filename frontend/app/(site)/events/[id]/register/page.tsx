"use client";

import { Turnstile, type TurnstileInstance } from "@marsidev/react-turnstile";
import Link from "next/link";
import { useCallback, useRef, useState } from "react";
import { api, API_MODE, ApiError } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { eventPath } from "@/lib/state/journey";
import { useJourney } from "@/lib/state/JourneyProvider";
import { BackLink, LoadState, PageShell, useRouteGuard } from "@/components/site/chrome";
import { fmtDate, fmtPrice } from "@/components/site/format";
import { errorCopy, stableKey, useAction } from "@/components/site/useAction";
import { EventArt } from "@/components/illustrations";
import { buttonClass, cx, ErrorState } from "@/components/ui";

// Cloudflare's always-pass test key keeps local dev and mock demos working without setup.
const SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY || "1x00000000000000000000AA";

const ORGS = [
  "Fr. Conceicao Rodrigues College of Engineering",
  "IIT Bombay",
  "VJTI Mumbai",
  "Sardar Patel Institute of Technology",
  "DJ Sanghvi College of Engineering",
  "Thadomal Shahani Engineering College",
  "GDG Mumbai community",
];

async function verifyLocally(token: string) {
  // live: the backend verifies inside POST /register. mock: our server route does. The widget alone is never trusted.
  if (API_MODE === "live") return;
  const res = await fetch("/api/turnstile", { method: "POST", body: JSON.stringify({ token }) }).catch(() => null);
  if (!res?.ok) throw new ApiError(res?.status ?? 0, "turnstile_failed", "Human verification didn't go through. Please try it again.");
}

function GoogleMark() {
  return (
    <svg viewBox="0 0 24 24" className="size-5 shrink-0" aria-hidden>
      <path fill="#4285F4" d="M23.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.4h6.5a5.6 5.6 0 0 1-2.4 3.6v3h3.9c2.2-2.1 3.5-5.1 3.5-8.7Z" />
      <path fill="#34A853" d="M12 24c3.2 0 6-1.1 7.9-2.9l-3.9-3a7.2 7.2 0 0 1-10.8-3.8h-4v3.1A12 12 0 0 0 12 24Z" />
      <path fill="#FBBC05" d="M5.3 14.3a7.2 7.2 0 0 1 0-4.6V6.6h-4a12 12 0 0 0 0 10.8l4-3.1Z" />
      <path fill="#EA4335" d="M12 4.8c1.8 0 3.3.6 4.6 1.8l3.4-3.4A12 12 0 0 0 1.3 6.6l4 3.1A7.2 7.2 0 0 1 12 4.8Z" />
    </svg>
  );
}

const STEPS = [
  { num: 1, label: "Sign In" },
  { num: 2, label: "Details" },
  { num: 3, label: "Human Check" },
  { num: 4, label: "Enter Drop" },
];

export default function Register() {
  const me = useRouteGuard("register");
  const { event, eventId, setMe, error: loadError } = useJourney();
  const { user, loading, signIn } = useAuth();
  const [name, setName] = useState<string | null>(null);
  const [org, setOrg] = useState("");
  const [eligible, setEligible] = useState(false);
  const [token, setToken] = useState<string | null>(null);
  const [captchaError, setCaptchaError] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const ts = useRef<TurnstileInstance>(null);

  const fullName = name ?? user?.name ?? "";
  const detailsOk = fullName.trim().length > 1 && org !== "" && eligible;

  const submit = useCallback(async () => {
    if (!token || !user || !detailsOk) return;
    await verifyLocally(token);
    const res = await api.register(eventId, {
      turnstile_token: token,
      idempotency_key: stableKey(`register.${eventId}.${user.id}`),
      full_name: fullName.trim(),
      organization: org,
      eligibility_confirmed: true,
    });
    setMe(res.me); // route guard moves us to the queue
  }, [token, user, detailsOk, fullName, org, setMe, eventId]);
  const action = useAction(submit);

  const onSubmit = async () => {
    await action.run();
    // tokens are single-use: reset in case we're still here after an error
    ts.current?.reset();
    setToken(null);
  };

  if ((!me && loadError?.status !== 401) || !event) return <LoadState />;

  if (event.phase !== "REGISTRATION_OPEN")
    return (
      <PageShell>
        <ErrorState
          title="Registration is closed"
          body="The entry list for this event is frozen, so new entries can't be added. Other events may still be open."
          action={
            <Link href="/events" className={buttonClass("secondary")}>
              Browse other events
            </Link>
          }
        />
      </PageShell>
    );

  const step = !user ? 0 : !detailsOk ? 1 : !token ? 2 : 3;

  return (
    <PageShell>
      <BackLink href={eventPath(eventId)}>{event.name}</BackLink>
      
      <div className="mt-8 grid grid-cols-1 gap-10 lg:grid-cols-[1.3fr_1fr] lg:gap-14">
        {/* Main Registration Card */}
        <div className="min-w-0 bg-surface p-6 sm:p-8 md:p-12 rounded-xl border border-line shadow-sm">
          {/* 4-step visual stepper */}
          <div className="mb-8 border-b border-zinc-100 pb-6">
            <div className="flex items-center justify-between gap-2 sm:gap-3">
              {STEPS.map((s, i) => {
                const isCompleted = i < step;
                const isCurrent = i === step;
                return (
                  <div key={s.label} className="flex flex-1 items-center gap-2">
                    <div className="flex items-center gap-2">
                      <span
                        className={cx(
                          "flex size-7 sm:size-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold transition-all",
                          isCompleted && "bg-zinc-900 text-white shadow-sm ",
                          isCurrent && "border-2 border-zinc-900 bg-bg-2 text-fg font-semibold",
                          !isCompleted && !isCurrent && "bg-zinc-100 text-zinc-400 border border-line"
                        )}
                      >
                        {isCompleted ? (
                          <svg viewBox="0 0 16 16" className="size-3.5" aria-hidden>
                            <path d="M3.5 8.5l3 3 6-6.5" stroke="currentColor" strokeWidth="2.2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                        ) : (
                          s.num
                        )}
                      </span>
                      <span
                        className={cx(
                          "hidden sm:inline text-xs font-medium whitespace-nowrap",
                          isCurrent && "text-zinc-900 font-semibold",
                          isCompleted && "text-emerald-700 font-medium",
                          !isCompleted && !isCurrent && "text-zinc-400"
                        )}
                      >
                        {s.label}
                      </span>
                    </div>
                    {i < STEPS.length - 1 && (
                      <div
                        className={cx(
                          "h-0.5 flex-1 rounded-full transition-colors mx-1",
                          i < step ? "bg-emerald-500" : "bg-zinc-100"
                        )}
                      />
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          <div>
            <span className="eyebrow">Fair Participant Drop</span>
            <h1 className="page-title mt-2">
              Create your account.
            </h1>
            <p className="mt-2 text-sm text-zinc-600">
              Sign in with Google to continue. One person, one entry.
            </p>
          </div>

          {/* Reassurance copy banner */}
          <div className="mt-5 rounded-xl border border-emerald-200/60 bg-emerald-50/50 p-4 text-xs leading-relaxed text-emerald-900 flex items-start gap-3">
            <span className="mt-0.5 text-base leading-none" aria-hidden>🛡️</span>
            <div>
              <strong className="font-semibold text-emerald-950">Fair Queue Policy:</strong> Early registration does not grant early queue position. All entrants are placed into a randomized queue once registration closes, guaranteeing everyone an equal chance.
            </div>
          </div>

          {/* Step 1: Google OAuth Section */}
          <div className="mt-8">
            <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-700 mb-2">
              Step 1 · Identity Verification
            </label>
            {loading ? (
              <div className="h-12 rounded-xl bg-zinc-100 animate-pulse" />
            ) : user ? (
              <div className="flex items-center justify-between rounded-xl border border-emerald-200/80 bg-emerald-50/40 p-3.5 text-sm">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-surface border border-line shadow-sm">
                    <GoogleMark />
                  </div>
                  <div className="min-w-0">
                    <div className="font-semibold text-zinc-900 truncate">{user.name}</div>
                    <div className="text-xs text-zinc-500 truncate">{user.email || (user.mock ? "demo account" : "Google Account")}</div>
                  </div>
                </div>
                <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100/90 px-3 py-1 text-xs font-semibold text-emerald-800">
                  <svg viewBox="0 0 16 16" className="size-3" aria-hidden>
                    <path d="M3.5 8.5l3 3 6-6.5" stroke="currentColor" strokeWidth="2.2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  Signed In
                </span>
              </div>
            ) : (
              <div>
                <button
                  type="button"
                  onClick={() => signIn(eventPath(eventId, "register")).catch(() => setAuthError("Google sign-in didn't start. Please try again."))}
                  className="w-full flex items-center justify-center gap-3 py-3.5 px-5 bg-surface hover:bg-zinc-50 border border-line hover:border-zinc-300 rounded-xl font-semibold text-zinc-900 shadow-sm transition-all duration-200 active:scale-[0.99]"
                >
                  <GoogleMark />
                  <span>Continue with Google</span>
                </button>
                {authError && <p className="mt-2 text-sm text-red-600">{authError}</p>}
              </div>
            )}
          </div>

          {/* Step 2 & 3: Details & Turnstile */}
          <fieldset disabled={!user} className={cx("mt-7 space-y-5 transition-opacity", !user && "opacity-45")}>
            <legend className="sr-only">Your details</legend>

            <div>
              <label htmlFor="full_name" className="block text-xs font-semibold uppercase tracking-wider text-zinc-700 mb-2">
                Step 2 · Attendee Name
              </label>
              <input
                id="full_name"
                name="full_name"
                type="text"
                autoComplete="name"
                value={fullName}
                onChange={(e) => setName(e.target.value)}
                placeholder="As shown on your official photo ID"
                className="form-input"
              />
              <p className="mt-1 text-xs text-zinc-500">Required to match entrance ID at venue check-in.</p>
            </div>

            <div>
              <label htmlFor="organization" className="block text-xs font-semibold uppercase tracking-wider text-zinc-700 mb-2">
                College / Organization
              </label>
              <div className="relative">
                <select
                  id="organization"
                  name="organization"
                  value={org}
                  onChange={(e) => setOrg(e.target.value)}
                  className="form-input appearance-none bg-surface pr-10 cursor-pointer"
                >
                  <option value="" disabled>
                    Select your college or organization
                  </option>
                  {ORGS.map((o) => (
                    <option key={o} value={o}>{o}</option>
                  ))}
                  <option value="Other">Other</option>
                </select>
                <svg viewBox="0 0 16 16" className="pointer-events-none absolute right-3.5 top-1/2 size-4 -translate-y-1/2 text-zinc-400" aria-hidden>
                  <path d="M4 6l4 4 4-4" stroke="currentColor" strokeWidth="1.8" fill="none" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>
            </div>

            <div className="pt-1">
              <label className="flex cursor-pointer items-start gap-3 text-sm text-zinc-700 select-none">
                <input
                  type="checkbox"
                  checked={eligible}
                  onChange={(e) => setEligible(e.target.checked)}
                  className="mt-0.5 size-4.5 shrink-0 rounded cursor-pointer accent-emerald-600"
                />
                <span className="leading-snug">
                  I confirm I am eligible to participate according to event rules and accept the 1-ticket limit.
                </span>
              </label>
            </div>

            {/* Step 3: Turnstile human verification container card */}
            <div className={cx("rounded-xl border border-line bg-zinc-50/70 p-5 transition-all", !detailsOk && "opacity-60")}>
              <div className="flex items-center justify-between gap-3">
                <span className="flex items-center gap-2 text-sm font-semibold text-zinc-900">
                  {token ? (
                    <span className="flex size-5 items-center justify-center rounded-full bg-zinc-900 text-white">
                      <svg viewBox="0 0 16 16" className="size-3" aria-hidden>
                        <path d="M3.5 8.5l3 3 6-6.5" stroke="currentColor" strokeWidth="2.2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </span>
                  ) : (
                    <span className="size-5 rounded-full border-2 border-zinc-300" aria-hidden />
                  )}
                  {token ? "Verification Complete" : "Step 3 · Human Verification"}
                </span>
                <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-zinc-500">Cloudflare Turnstile</span>
              </div>
              <div className="mt-3.5 min-h-[65px] flex items-center justify-center sm:justify-start">
                {user && detailsOk ? (
                  <Turnstile
                    ref={ts}
                    siteKey={SITE_KEY}
                    options={{ theme: "light", size: "flexible", action: "register" }}
                    onSuccess={(t) => {
                      setToken(t);
                      setCaptchaError(false);
                    }}
                    onExpire={() => setToken(null)}
                    onError={() => setCaptchaError(true)}
                  />
                ) : (
                  <p className="py-2 text-xs text-zinc-500">
                    {!user ? "Sign in with Google to enable verification." : "Provide your full name and select an organization above to verify."}
                  </p>
                )}
              </div>
              {captchaError && (
                <p className="mt-2 text-xs font-medium text-red-600">
                  Verification couldn&apos;t load. Please disable ad-blockers or try another network.
                </p>
              )}
            </div>
          </fieldset>

          {/* High-impact emerald CTA button */}
          <button
            type="button"
            disabled={step < 3 || action.blocked}
            onClick={onSubmit}
            className="mt-8 w-full bg-zinc-900 hover:bg-zinc-800 text-white font-semibold py-4 rounded-xl shadow-sm  transition-all duration-200 flex items-center justify-center gap-2 text-base active:scale-[0.99] disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {action.pending ? (
              <>
                <span className="size-4 animate-spin rounded-full border-2 border-white border-r-transparent" aria-hidden />
                <span>Securing Your Entry...</span>
              </>
            ) : action.retryIn > 0 ? (
              `Try again in ${action.retryIn}s`
            ) : (
              <>
                <span>Enter the Drop</span>
                <span aria-hidden>→</span>
              </>
            )}
          </button>

          {action.error && (
            <p role="alert" className="mt-4 text-center text-sm font-medium text-red-600">
              {errorCopy(action.error, action.retryIn)}
            </p>
          )}

          <p className="mt-4 text-center text-xs text-zinc-500">
            Submitting twice is safe. Idempotency guarantees exactly one entry is recorded.
          </p>
        </div>

        {/* Aside: Event Overview & Trust Signals */}
        <aside className="hidden lg:block">
          <div className="sticky top-24 space-y-6">
            <div className="overflow-hidden rounded-xl border border-line bg-surface shadow-sm p-6">
              <div className="overflow-hidden rounded-xl border border-zinc-100 bg-zinc-50">
                <EventArt category={event.category} className="aspect-[3/2] w-full" />
              </div>
              <div className="mt-5">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-emerald-600">Event Overview</span>
                <h2 className="serif text-2xl font-semibold text-zinc-900 mt-1">{event.name}</h2>
                <div className="mt-2 text-sm text-zinc-600 flex flex-col gap-1">
                  <span>{fmtDate(event.starts_at)}</span>
                  <span>{event.venue}, {event.city}</span>
                  <span className="font-semibold text-zinc-900">{fmtPrice(event.price_inr)}</span>
                </div>
              </div>
            </div>

            <div className="rounded-xl border border-line bg-surface p-6 shadow-sm">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-900 mb-4">Drop Security Guarantees</h3>
              <ul className="space-y-3.5 text-xs text-zinc-600">
                <li className="flex items-start gap-2.5">
                  <span className="size-1.5 rounded-full bg-emerald-600 mt-1.5 shrink-0" />
                  <div>
                    <strong className="text-zinc-900 font-semibold">Random Queue Order:</strong> No advantage to fast registration. Positions are shuffled at draw time.
                  </div>
                </li>
                <li className="flex items-start gap-2.5">
                  <span className="size-1.5 rounded-full bg-emerald-600 mt-1.5 shrink-0" />
                  <div>
                    <strong className="text-zinc-900 font-semibold">Sybil Resistant:</strong> One verified entrant per authenticated Google account.
                  </div>
                </li>
                <li className="flex items-start gap-2.5">
                  <span className="size-1.5 rounded-full bg-emerald-600 mt-1.5 shrink-0" />
                  <div>
                    <strong className="text-zinc-900 font-semibold">Protected Claim Window:</strong> When your turn arrives, your ticket is held exclusively for you.
                  </div>
                </li>
              </ul>
            </div>
          </div>
        </aside>
      </div>
    </PageShell>
  );
}
