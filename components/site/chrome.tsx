"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { API_MODE } from "@/lib/api";
import { applyScenario, SCENARIOS, type Scenario } from "@/lib/api/mock";
import { useAuth } from "@/lib/auth";
import { eventPath, routeFor, type Route } from "@/lib/state/journey";
import { useJourney } from "@/lib/state/JourneyProvider";
import { Button, buttonClass, cx, ErrorState, LoadingDots, Wordmark } from "@/components/ui";

export const PAD = "px-5 sm:px-8 lg:px-12";
export const WRAP = "mx-auto w-full max-w-[1280px]";

const NAV = [
  ["/events", "Events"],
  ["/#how", "How it works"],
  ["/#faq", "FAQ"],
  ["/my-tickets", "My tickets"],
] as const;

/** Floating pill navigation. */
export function SiteHeader() {
  const { user, signOut } = useAuth();
  const [open, setOpen] = useState(false);
  const path = usePathname();

  return (
    <header className="sticky top-0 z-40 px-3 pt-3 sm:pt-4">
      <div className="mx-auto flex h-14 max-w-[880px] items-center justify-between gap-3 rounded-full border border-line/80 bg-surface/85 pl-5 pr-2 shadow-[var(--shadow-soft)] backdrop-blur-md">
        <Link href="/" aria-label="Fair Drop home" className="shrink-0">
          <Wordmark className="text-[20px]" />
        </Link>
        <span className="hidden h-5 w-px bg-line md:block" aria-hidden />
        <nav aria-label="Main" className="hidden flex-1 items-center gap-6 text-[15px] text-muted md:flex">
          {NAV.map(([href, label]) => (
            <Link key={href} href={href} className={cx("transition-colors hover:text-fg", path === href && "text-fg")}>
              {label}
            </Link>
          ))}
        </nav>
        <div className="flex items-center gap-2">
          {user ? (
            <button
              onClick={() => void signOut()}
              title={`${user.name}. Sign out`}
              aria-label={`Signed in as ${user.name}. Sign out`}
              className="serif hidden size-9 place-items-center rounded-full bg-accent-soft text-[17px] font-semibold text-[#8a5a1f] sm:grid"
            >
              {user.name.slice(0, 1).toUpperCase()}
            </button>
          ) : null}
          <Link href="/events" className={cx(buttonClass("primary", "sm"), "h-10 px-5")}>
            Browse drops
          </Link>
          <button
            className="grid size-10 place-items-center rounded-full text-fg md:hidden"
            aria-label="Menu"
            aria-expanded={open}
            onClick={() => setOpen((o) => !o)}
          >
            <svg viewBox="0 0 20 20" className="size-5" aria-hidden>
              <path d={open ? "M5 5l10 10M15 5L5 15" : "M3 7h14M3 13h14"} stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
            </svg>
          </button>
        </div>
      </div>
      {open && (
        <nav aria-label="Mobile" className="rise mx-auto mt-2 max-w-[880px] rounded-[20px] border border-line bg-surface p-3 shadow-[var(--shadow-soft)] md:hidden">
          {NAV.map(([href, label]) => (
            <Link key={href} href={href} onClick={() => setOpen(false)} className="block rounded-xl px-4 py-3 text-[15px] hover:bg-bg-2">
              {label}
            </Link>
          ))}
          {user && (
            <button onClick={() => void signOut()} className="block w-full rounded-xl px-4 py-3 text-left text-[15px] text-muted hover:bg-bg-2">
              Sign out ({user.name})
            </button>
          )}
        </nav>
      )}
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className={cx("mt-auto border-t border-line bg-bg-2/60", PAD)}>
      <div className={cx(WRAP, "grid gap-8 py-12 sm:grid-cols-[1.4fr_1fr_1fr]")}>
        <div>
          <Wordmark />
          <p className="mt-3 max-w-xs text-sm leading-relaxed text-muted">
            Ticket drops where speed, refreshes and bots don&apos;t decide who gets in. One person, one entry, a random queue.
          </p>
        </div>
        <div className="text-sm">
          <div className="eyebrow mb-3">Explore</div>
          <ul className="space-y-2 text-muted">
            <li>
              <Link href="/events" className="hover:text-fg">
                All events
              </Link>
            </li>
            <li>
              <Link href="/my-tickets" className="hover:text-fg">
                My tickets
              </Link>
            </li>
            <li>
              <Link href="/#how" className="hover:text-fg">
                How it works
              </Link>
            </li>
          </ul>
        </div>
        <div className="text-sm">
          <div className="eyebrow mb-3">Built for</div>
          <p className="text-muted">GDG On Campus CRCE · Bit N Build 2026 · Problem statement 3</p>
          {API_MODE === "mock" && <p className="mt-3 text-xs text-muted/80">Prototype: events and numbers are sample data.</p>}
        </div>
      </div>
    </footer>
  );
}

/** Keep the participant on the screen /me says they belong on, within this event. */
export function useRouteGuard(here: Route, alsoFor?: Route) {
  const { me, eventId } = useJourney();
  const router = useRouter();
  const ok = !!me && (routeFor(me) === here || routeFor(me) === alsoFor);
  useEffect(() => {
    if (me && !ok) router.replace(eventPath(eventId, routeFor(me)));
  }, [me, ok, router, eventId]);
  return ok ? me : undefined;
}

export function PageShell({ children, className }: { children: ReactNode; className?: string }) {
  return <main className={cx(WRAP, "flex-1 py-12 sm:py-16", PAD, className)}>{children}</main>;
}

const RESTORING: Partial<Record<Route, string>> = {
  queue: "Restoring your queue position",
  reservation: "Restoring your reservation",
  confirmed: "Opening your ticket",
  ticket: "Opening your ticket",
};

export function LoadState({ route }: { route?: Route }) {
  const { error, refresh, eventId } = useJourney();
  if (error?.status === 404)
    return (
      <PageShell>
        <ErrorState
          title="We couldn't find that event"
          body="It may have been removed, or the link is wrong."
          action={
            <Link href="/events" className={buttonClass()}>
              Browse events
            </Link>
          }
        />
      </PageShell>
    );
  if (error?.status === 401)
    return (
      <PageShell>
        <ErrorState
          title="Sign in to continue"
          body="Your entry is tied to your Google account, so it's there on any device."
          action={
            <Link href={eventPath(eventId, "register")} className={buttonClass()}>
              Sign in <span aria-hidden>→</span>
            </Link>
          }
        />
      </PageShell>
    );
  if (error && (error.status >= 500 || error.code === "contract_mismatch"))
    return (
      <PageShell>
        <ErrorState
          title="Something went wrong"
          body="We couldn't restore your session. Your entry is safe on the server."
          action={<Button onClick={() => void refresh()}>Try again</Button>}
        />
      </PageShell>
    );
  return (
    <PageShell>
      <div className="flex min-h-[45vh] items-center justify-center" aria-busy="true">
        <LoadingDots>{(route && RESTORING[route]) ?? "Loading"}</LoadingDots>
      </div>
    </PageShell>
  );
}

export function RestoredNote({ children = "Position restored" }: { children?: ReactNode }) {
  const { restored } = useJourney();
  const [show, setShow] = useState(true);
  useEffect(() => {
    const t = setTimeout(() => setShow(false), 4000);
    return () => clearTimeout(t);
  }, []);
  if (!restored) return null;
  return (
    <span role="status" className={cx("inline-flex items-center gap-1.5 text-[13px] font-semibold text-success transition-opacity duration-500", !show && "opacity-0")}>
      <svg viewBox="0 0 16 16" className="size-3.5" aria-hidden>
        <path d="M3 8.5l3 3 7-7" stroke="currentColor" strokeWidth="1.8" fill="none" />
      </svg>
      {children}
    </span>
  );
}

export function BackLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link href={href} className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-fg">
      <span aria-hidden>←</span> {children}
    </Link>
  );
}

/** Mock-mode only: jump this event between journey states for demos and testing. */
export function DevPanel() {
  const [open, setOpen] = useState(false);
  const { refresh, eventId } = useJourney();
  useEffect(() => {
    const s = new URLSearchParams(location.search).get("scenario") as Scenario | null;
    if (API_MODE === "mock" && s && SCENARIOS.includes(s)) {
      applyScenario(eventId, s);
      void refresh();
    }
  }, [refresh, eventId]);
  if (API_MODE !== "mock") return null;
  const go = (s: Scenario) => {
    applyScenario(eventId, s);
    void refresh();
  };
  return (
    <div className="fixed bottom-4 right-4 z-40 text-xs">
      {open ? (
        <div className="rise w-64 rounded-[20px] border border-line bg-surface p-4 shadow-[var(--shadow-soft)]">
          <div className="mb-3 flex items-center justify-between">
            <span className="eyebrow">Demo states</span>
            <button className="text-muted hover:text-fg" onClick={() => setOpen(false)} aria-label="Close demo panel">
              Close
            </button>
          </div>
          <div className="flex flex-wrap gap-1" data-testid="dev-scenarios">
            {SCENARIOS.map((s) => (
              <button key={s} onClick={() => go(s)} className="rounded-full border border-line px-2.5 py-1 text-muted hover:border-accent hover:text-accent">
                {s.replace(/_/g, " ")}
              </button>
            ))}
          </div>
          <Link href={`/admin?event=${eventId}`} className="mt-4 block font-semibold text-accent">
            Open admin <span aria-hidden>→</span>
          </Link>
        </div>
      ) : (
        <button onClick={() => setOpen(true)} className="rounded-full border border-line bg-surface px-4 py-2 font-semibold text-muted shadow-[var(--shadow-soft)] hover:text-fg">
          Demo
        </button>
      )}
    </div>
  );
}
