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
import { Button, buttonClass, Checkbox, cx, ErrorState, Input, Select } from "@/components/ui";

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
    <svg viewBox="0 0 24 24" className="size-[18px]" aria-hidden>
      <path fill="#4285F4" d="M23.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.4h6.5a5.6 5.6 0 0 1-2.4 3.6v3h3.9c2.2-2.1 3.5-5.1 3.5-8.7Z" />
      <path fill="#34A853" d="M12 24c3.2 0 6-1.1 7.9-2.9l-3.9-3a7.2 7.2 0 0 1-10.8-3.8h-4v3.1A12 12 0 0 0 12 24Z" />
      <path fill="#FBBC05" d="M5.3 14.3a7.2 7.2 0 0 1 0-4.6V6.6h-4a12 12 0 0 0 0 10.8l4-3.1Z" />
      <path fill="#EA4335" d="M12 4.8c1.8 0 3.3.6 4.6 1.8l3.4-3.4A12 12 0 0 0 1.3 6.6l4 3.1A7.2 7.2 0 0 1 12 4.8Z" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <span className="grid size-5 place-items-center rounded-full bg-success text-white" aria-label="Done">
      <svg viewBox="0 0 16 16" className="size-3" aria-hidden>
        <path d="M3.5 8.5l3 3 6-6.5" stroke="currentColor" strokeWidth="2" fill="none" />
      </svg>
    </span>
  );
}

const STEPS = ["Sign in", "Your details", "Human check", "Enter the drop"];

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
    <PageShell className="pt-8 sm:pt-10">
      <BackLink href={eventPath(eventId)}>{event.name}</BackLink>
      <div className="mt-8 grid gap-12 lg:grid-cols-[1.25fr_1fr] lg:gap-16">
        <div className="rounded-[26px] border border-line/80 bg-surface p-7 shadow-[var(--shadow-soft)] sm:p-12">
          <div className="flex items-center gap-4">
            <span className="num shrink-0 text-[13px] font-bold text-accent">Step {step + 1} of 4</span>
            <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-line">
              <div className="h-full rounded-full bg-gradient-to-r from-accent-2 to-accent transition-[width] duration-300" style={{ width: `${((step + 1) / 4) * 100}%` }} />
            </div>
          </div>

          <h1 className="display mt-8 text-[clamp(2.4rem,5vw,3.6rem)]">
            Join the <em>drop.</em>
          </h1>
          <p className="mt-3 text-[17px] text-muted">One entry per Google account. Your position is drawn at random after registration closes.</p>

          <div className="mt-9">
            {loading ? (
              <div className="h-12" />
            ) : user ? (
              <div className="flex h-12 items-center justify-between rounded-full border border-line bg-bg px-5 text-[15px]">
                <span className="flex items-center gap-3">
                  <GoogleMark />
                  <span className="font-semibold">{user.name}</span>
                  {user.mock && <span className="text-muted">· demo account</span>}
                </span>
                <CheckIcon />
              </div>
            ) : (
              <>
                <Button
                  variant="secondary"
                  className="h-12 w-full"
                  onClick={() => signIn(eventPath(eventId, "register")).catch(() => setAuthError("Google sign-in didn't start. Please try again."))}
                >
                  <GoogleMark /> Continue with Google
                </Button>
                {authError && <p className="mt-2 text-sm text-danger">{authError}</p>}
              </>
            )}
          </div>

          <fieldset disabled={!user} className={cx("mt-8 space-y-6 transition-opacity", !user && "opacity-45")}>
            <legend className="sr-only">Your details</legend>
            <Input label="Full name" name="full_name" autoComplete="name" value={fullName} onChange={(e) => setName(e.target.value)} placeholder="As on your ID" />
            <Select label="College / organization" name="organization" value={org} onChange={(e) => setOrg(e.target.value)}>
              <option value="" disabled>
                Select your college or organization
              </option>
              {ORGS.map((o) => (
                <option key={o}>{o}</option>
              ))}
              <option>Other</option>
            </Select>
            <Checkbox checked={eligible} onChange={(e) => setEligible(e.target.checked)} label="I confirm I am eligible to participate" />

            <div className={cx("rounded-[18px] border border-line bg-bg p-5", !detailsOk && "opacity-60")}>
              <div className="flex items-center justify-between gap-3">
                <span className="flex items-center gap-2.5 text-[15px] font-semibold">
                  {token ? <CheckIcon /> : <span className="size-5 rounded-full border-2 border-line" aria-hidden />}
                  {token ? "Verified" : "Verify you are human"}
                </span>
                <span className="text-[10px] font-bold uppercase tracking-[0.16em] text-muted">Cloudflare Turnstile</span>
              </div>
              <div className="mt-3 min-h-[65px]">
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
                  <p className="pt-4 text-[13px] text-muted">Fill in your details to start the check.</p>
                )}
              </div>
              {captchaError && <p className="mt-2 text-sm text-danger">The check couldn&apos;t load. Turn off content blockers for this page or try another network.</p>}
            </div>
          </fieldset>

          <Button size="lg" className="mt-9 w-full" disabled={step < 3 || action.blocked} loading={action.pending} onClick={onSubmit}>
            {action.retryIn > 0 ? (
              `Try again in ${action.retryIn}s`
            ) : (
              <>
                Continue <span aria-hidden>→</span>
              </>
            )}
          </Button>
          {action.error && (
            <p role="alert" className="mt-4 text-sm text-danger">
              {errorCopy(action.error, action.retryIn)}
            </p>
          )}
          <p className="mt-4 text-center text-[13px] text-muted">Submitting twice is safe. It always returns your one entry.</p>
        </div>

        <aside className="hidden lg:block">
          <div className="sticky top-24">
            <div className="overflow-hidden rounded-[22px] border border-line/80 bg-bg-2">
              <EventArt category={event.category} className="aspect-[3/2] w-full" />
            </div>
            <div className="mt-5">
              <div className="serif text-3xl font-semibold">{event.name}</div>
              <div className="mt-1 text-muted">
                {fmtDate(event.starts_at)} · {event.city} · {fmtPrice(event.price_inr)}
              </div>
            </div>
            <ol className="mt-8 space-y-1">
              {STEPS.map((s, i) => (
                <li
                  key={s}
                  aria-current={i === step ? "step" : undefined}
                  className={cx("flex items-center gap-3 rounded-full px-4 py-2.5 text-[15px]", i === step && "bg-surface font-semibold shadow-[var(--shadow-soft)]")}
                >
                  <span
                    className={cx(
                      "grid size-6 place-items-center rounded-full text-[11px] font-bold",
                      i < step ? "bg-success-soft text-success" : i === step ? "bg-accent text-white" : "bg-bg-2 text-muted",
                    )}
                  >
                    {i < step ? "✓" : i + 1}
                  </span>
                  <span className={i > step ? "text-muted" : ""}>{s}</span>
                </li>
              ))}
            </ol>
          </div>
        </aside>
      </div>
    </PageShell>
  );
}
