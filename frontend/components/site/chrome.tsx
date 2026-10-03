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

export const PAD = "px-4 sm:px-6 lg:px-8";
export const WRAP = "max-w-7xl mx-auto";

const NAV = [
  ["/events", "Drops"],
  ["/#how", "How It Works"],
  ["/#defense", "Anti-Bot Defense"],
  ["/#faq", "FAQ"],
  ["/my-tickets", "My Tickets"],
] as const;

/** Floating pill navigation matching the new modern glass template */
export function SiteHeader() {
  const { user, signOut } = useAuth();
  const [open, setOpen] = useState(false);
  const path = usePathname();

  return (
    <header className="fixed top-0 left-0 right-0 z-50 px-4 py-4 md:px-6">
      <div className="max-w-7xl mx-auto">
        <div className="glass-panel border border-zinc-200/60 rounded-full px-5 py-3 flex items-center justify-between shadow-sm">
          <Link href="/" aria-label="Fair Drop home" className="text-sm font-semibold tracking-tight uppercase flex items-center gap-2.5 text-zinc-900">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-600 shadow-[0_0_8px_rgba(5,150,105,0.4)]" aria-hidden />
            FAIR DROP
          </Link>

          <nav aria-label="Main" className="hidden md:flex gap-7 text-sm font-medium text-zinc-600 items-center">
            {NAV.map(([href, label]) => (
              <Link
                key={href}
                href={href}
                className={cx(
                  "hover:text-emerald-700 transition-colors",
                  path === href && "text-emerald-600 font-semibold"
                )}
              >
                {label}
              </Link>
            ))}
          </nav>

          <div className="flex items-center gap-2.5">
            {user ? (
              <button
                onClick={() => void signOut()}
                title={`${user.name}. Click to sign out`}
                aria-label={`Signed in as ${user.name}. Sign out`}
                className="hidden sm:inline-flex items-center gap-2 text-xs font-medium text-zinc-700 bg-zinc-100 hover:bg-zinc-200 rounded-full py-1.5 px-3 transition-colors"
              >
                <span className="size-2 rounded-full bg-emerald-500" />
                {user.name.split(" ")[0]}
              </button>
            ) : null}

            <Link
              href="/events"
              className="group flex items-center gap-2 hover:bg-zinc-800 transition-colors text-xs font-medium text-white bg-zinc-900 rounded-full py-2 px-4 shadow-sm"
            >
              Browse drops
              <span aria-hidden className="group-hover:translate-x-0.5 transition-transform text-zinc-400">→</span>
            </Link>

            <button
              className="grid size-9 place-items-center rounded-full text-zinc-800 hover:bg-zinc-100 md:hidden"
              aria-label="Menu"
              aria-expanded={open}
              onClick={() => setOpen((o) => !o)}
            >
              <svg viewBox="0 0 20 20" className="size-5" aria-hidden>
                <path d={open ? "M5 5l10 10M15 5L5 15" : "M3 7h14M3 13h14"} stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
              </svg>
            </button>
          </div>
        </div>

        {open && (
          <nav aria-label="Mobile" className="rise glass-panel mt-2 rounded-3xl border border-zinc-200/80 p-4 shadow-xl md:hidden">
            <div className="space-y-1">
              {NAV.map(([href, label]) => (
                <Link
                  key={href}
                  href={href}
                  onClick={() => setOpen(false)}
                  className="block rounded-xl px-4 py-2.5 text-sm font-medium text-zinc-700 hover:bg-emerald-50 hover:text-emerald-700 transition-colors"
                >
                  {label}
                </Link>
              ))}
            </div>
            {user && (
              <div className="mt-3 pt-3 border-t border-zinc-100 flex items-center justify-between px-2">
                <span className="text-xs text-zinc-500 font-light">Signed in as {user.name}</span>
                <button
                  onClick={() => void signOut()}
                  className="text-xs font-semibold text-red-600 hover:underline"
                >
                  Sign out
                </button>
              </div>
            )}
          </nav>
        )}
      </div>
    </header>
  );
}

/** Modern dark footer matching the template design */
export function SiteFooter() {
  return (
    <footer className="bg-zinc-900 text-zinc-400 py-16 px-6 border-t border-white/5 mt-auto">
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between gap-12">
        <div className="space-y-5 md:w-1/3">
          <div className="text-sm font-semibold tracking-tight uppercase flex items-center gap-2.5 text-white">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]"></span>
            FAIR DROP
          </div>
          <p className="text-sm font-light leading-relaxed text-zinc-400">
            Selling high-contention tickets without letting bots win. One entry per person, randomized queue shuffling, and server-protected reservations.
          </p>
          <div className="flex items-center gap-2 text-xs text-zinc-500 font-light">
            <span className="inline-block size-1.5 rounded-full bg-emerald-400"></span>
            GDG On Campus CRCE · Bit N Build 2026
          </div>
        </div>

        <div className="grid grid-cols-2 gap-12 md:w-1/2">
          <div className="space-y-4">
            <h4 className="text-xs font-semibold text-white uppercase tracking-widest">Platform</h4>
            <ul className="text-sm space-y-2.5 font-light">
              <li><Link href="/events" className="hover:text-emerald-400 transition-colors">All Drops</Link></li>
              <li><Link href="/my-tickets" className="hover:text-emerald-400 transition-colors">My Tickets</Link></li>
              <li><Link href="/#how" className="hover:text-emerald-400 transition-colors">How It Works</Link></li>
              <li><Link href="/#defense" className="hover:text-emerald-400 transition-colors">Bot Defense</Link></li>
              <li><Link href="/#faq" className="hover:text-emerald-400 transition-colors">FAQ</Link></li>
            </ul>
          </div>

          <div className="space-y-4">
            <h4 className="text-xs font-semibold text-white uppercase tracking-widest">Admin & Control</h4>
            <ul className="text-sm space-y-2.5 font-light">
              <li><Link href="/admin" className="hover:text-emerald-400 transition-colors">Admin Dashboard</Link></li>
              <li><Link href="/admin/queue" className="hover:text-emerald-400 transition-colors">Fairness Comparison</Link></li>
              <li><Link href="/admin/traffic" className="hover:text-emerald-400 transition-colors">Traffic Telemetry</Link></li>
              <li><Link href="/admin/security" className="hover:text-emerald-400 transition-colors">Security Feed</Link></li>
            </ul>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto mt-16 pt-8 border-t border-white/5 flex flex-col sm:flex-row justify-between text-xs font-light text-zinc-500 gap-4">
        <p>© 2026 Fair Drop. GDG Bit N Build Hackathon — Problem Statement 3.</p>
        <p>Built with Next.js, Turnstile &amp; Supabase SSR.</p>
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
  return <main className={cx(WRAP, "flex-1 pt-28 pb-16 sm:pb-24", PAD, className)}>{children}</main>;
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
          title="Drop Not Found"
          body="This event drop does not exist or may have been concluded."
          action={
            <Link href="/events" className={buttonClass("primary")}>
              Browse Events
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
          body="Your queue position is protected and tied to your verified account."
          action={
            <Link href={eventPath(eventId, "register")} className={buttonClass("primary")}>
              Sign In <span aria-hidden>→</span>
            </Link>
          }
        />
      </PageShell>
    );
  if (error && (error.status >= 500 || error.code === "contract_mismatch"))
    return (
      <PageShell>
        <ErrorState
          title="Connection Reconnecting"
          body="Could not refresh session state. Your entry is safe on the server."
          action={<Button variant="primary" onClick={() => void refresh()}>Try Again</Button>}
        />
      </PageShell>
    );
  return (
    <PageShell>
      <div className="flex min-h-[45vh] items-center justify-center" aria-busy="true">
        <LoadingDots>{(route && RESTORING[route]) ?? "Connecting to Fair Drop"}</LoadingDots>
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
    <span role="status" className={cx("inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200/70 transition-opacity duration-500", !show && "opacity-0")}>
      <svg viewBox="0 0 16 16" className="size-3.5" aria-hidden>
        <path d="M3 8.5l3 3 7-7" stroke="currentColor" strokeWidth="2" fill="none" />
      </svg>
      {children}
    </span>
  );
}

export function BackLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link href={href} className="inline-flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-zinc-500 hover:text-emerald-600 transition-colors">
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
    <div className="fixed bottom-4 right-4 z-50 text-xs">
      {open ? (
        <div className="rise w-72 rounded-3xl border border-zinc-200/80 bg-white/95 backdrop-blur-md p-4 shadow-2xl">
          <div className="mb-3 flex items-center justify-between pb-2 border-b border-zinc-100">
            <span className="text-xs font-semibold uppercase tracking-wider text-emerald-600">Demo Scenarios</span>
            <button className="text-zinc-400 hover:text-zinc-700 text-xs" onClick={() => setOpen(false)} aria-label="Close demo panel">
              ✕
            </button>
          </div>
          <div className="flex flex-wrap gap-1.5" data-testid="dev-scenarios">
            {SCENARIOS.map((s) => (
              <button
                key={s}
                onClick={() => go(s)}
                className="rounded-full border border-zinc-200 bg-zinc-50 px-2.5 py-1 text-[11px] font-medium text-zinc-600 hover:border-emerald-500 hover:bg-emerald-50 hover:text-emerald-700 transition-all"
              >
                {s.replace(/_/g, " ")}
              </button>
            ))}
          </div>
          <div className="mt-4 pt-3 border-t border-zinc-100 flex items-center justify-between">
            <Link href={`/admin?event=${eventId}`} className="font-semibold text-emerald-600 hover:text-emerald-700 text-xs">
              Open Admin Console →
            </Link>
          </div>
        </div>
      ) : (
        <button
          onClick={() => setOpen(true)}
          className="flex items-center gap-2 rounded-full border border-zinc-200/80 bg-white/90 backdrop-blur-md px-3.5 py-2 text-xs font-medium text-zinc-700 shadow-md hover:border-emerald-500 hover:text-emerald-600 transition-all"
        >
          <span className="size-2 rounded-full bg-emerald-500 animate-pulse" />
          Demo Scenarios
        </button>
      )}
    </div>
  );
}
