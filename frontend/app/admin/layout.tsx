"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useRef, useState, type ReactNode } from "react";
import type { EventInfo } from "@/lib/contracts";
import { API_MODE, api } from "@/lib/api";
import { useAuth, type AuthUser } from "@/lib/auth";
import { Button, ErrorState, Skeleton, cx } from "@/components/ui";
import { EventContext, Notice, PhaseBadge, usePoll, useEventPoll, withEvent } from "@/components/admin/shared";

const NAV = [
  ["/admin", "Dashboard", "M3 3h7v7H3zM14 3h7v7h-7zM14 14h7v7h-7zM3 14h7v7H3z"],
  ["/admin/queue", "Queue Fairness", "M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"],
  ["/admin/traffic", "Traffic Simulator", "M22 12h-4l-3 9L9 3l-3 9H2"],
  ["/admin/reservations", "Reservations", "M4 6h16M4 10h16M4 14h16M4 18h16"],
  ["/admin/security", "Security Feed", "M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"],
  ["/admin/settings", "Event Settings", "M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"],
] as const;

function DropStatusPill() {
  const { data } = useEventPoll();
  if (!data) return <Skeleton className="h-5 w-24 bg-zinc-800" />;
  return <PhaseBadge phase={data.phase} />;
}

function EventSwitcher({ id }: { id: string }) {
  const { eventId, events } = useEventPoll();
  const router = useRouter();
  const path = usePathname();
  return (
    <div className="grid gap-1.5">
      <label htmlFor={id} className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400">
        Active Drop
      </label>
      <div className="relative">
        <select
          id={id}
          value={eventId}
          onChange={(e) => router.replace(withEvent(path, e.target.value))}
          className="h-10 w-full cursor-pointer appearance-none truncate rounded-full border border-zinc-800 bg-zinc-900/90 pl-3.5 pr-8 text-xs font-medium text-zinc-200 shadow-inner outline-none transition-colors hover:border-zinc-700 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
        >
          {events.map((e) => (
            <option key={e.id} value={e.id} className="bg-zinc-900 text-zinc-200">
              {e.name} · {e.city}
            </option>
          ))}
        </select>
        <span aria-hidden className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-[9px] text-zinc-400">
          ▼
        </span>
      </div>
    </div>
  );
}

function Nav({ onNavigate }: { onNavigate?: () => void }) {
  const path = usePathname();
  const { eventId } = useEventPoll();
  return (
    <nav aria-label="Admin Navigation">
      <ul className="grid gap-1">
        {(API_MODE === "live" ? NAV.slice(0, 1) : NAV).map(([href, label, iconPath]) => {
          const active = href === "/admin" ? path === href : path.startsWith(href);
          return (
            <li key={href}>
              <Link
                href={withEvent(href, eventId)}
                onClick={onNavigate}
                aria-current={active ? "page" : undefined}
                className={cx(
                  "flex items-center justify-between rounded-xl px-3.5 py-2.5 text-xs font-medium transition-all duration-150",
                  active
                    ? "bg-zinc-900 text-emerald-400 shadow-sm border border-zinc-800"
                    : "text-zinc-400 hover:bg-zinc-900/60 hover:text-zinc-200"
                )}
              >
                <span className="flex items-center gap-2.5">
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className={cx("size-4 shrink-0", active ? "text-emerald-500" : "text-zinc-500")}
                    aria-hidden
                  >
                    <path d={iconPath} />
                  </svg>
                  <span>{label}</span>
                </span>
                {active && (
                  <span
                    className="size-1.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.8)]"
                    aria-hidden
                  />
                )}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

function Profile({ user, onSignOut }: { user: AuthUser; onSignOut: () => void }) {
  const { eventId } = useEventPoll();
  return (
    <div className="grid gap-4 border-t border-zinc-800/80 pt-5">
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">Lifecycle</span>
        <DropStatusPill />
      </div>

      {/* Quick link to public site */}
      <Link
        href={`/events/${eventId}`}
        target="_blank"
        rel="noopener noreferrer"
        className="group flex items-center justify-between rounded-xl border border-zinc-800/90 bg-zinc-900/70 px-3.5 py-2 text-xs font-medium text-zinc-300 transition-colors hover:border-zinc-700 hover:text-white"
      >
        <span className="flex items-center gap-2">
          <span className="size-1.5 rounded-full bg-emerald-400" />
          <span>View Public Drop</span>
        </span>
        <span className="text-zinc-500 group-hover:text-emerald-400 group-hover:translate-x-0.5 transition-all">↗</span>
      </Link>

      <div className="flex items-center justify-between gap-3 pt-1">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="flex size-7 shrink-0 items-center justify-center rounded-full bg-zinc-800 border border-zinc-700 text-xs font-semibold text-emerald-400">
            {user.name.charAt(0).toUpperCase()}
          </div>
          <div className="min-w-0">
            <div className="truncate text-xs font-medium text-zinc-200">{user.name}</div>
            <div className="truncate text-[11px] text-zinc-500 font-light">{user.email}</div>
          </div>
        </div>
        <button
          onClick={onSignOut}
          className="shrink-0 rounded-lg px-2 py-1 text-xs text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200 transition-colors"
        >
          Sign out
        </button>
      </div>
    </div>
  );
}

function Drawer({ open, onClose, children }: { open: boolean; onClose: () => void; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const el = ref.current;
    el?.querySelector<HTMLElement>("a,button,select")?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") return onClose();
      if (e.key !== "Tab" || !el) return;
      const f = el.querySelectorAll<HTMLElement>("a,button,select");
      const first = f[0];
      const last = f[f.length - 1];
      const target = e.shiftKey ? (document.activeElement === first ? last : null) : document.activeElement === last ? first : null;
      if (target) {
        e.preventDefault();
        target.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-40 lg:hidden">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} aria-hidden />
      <div
        ref={ref}
        id="admin-drawer"
        role="dialog"
        aria-modal="true"
        aria-label="Admin navigation"
        className="rise absolute inset-y-0 left-0 flex w-[280px] max-w-[85vw] flex-col gap-6 border-r border-zinc-800/80 bg-zinc-950 p-6 text-zinc-300"
      >
        <div className="flex items-center justify-between pb-2 border-b border-zinc-800">
          <span className="inline-flex items-center gap-2 text-xs font-semibold tracking-tight uppercase text-white">
            <span className="size-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.8)]" />
            Fair Drop
          </span>
          <button onClick={onClose} className="rounded-full px-2.5 py-1 text-xs text-zinc-400 hover:bg-zinc-800 hover:text-white">
            Close
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

function Shell({ user, onSignOut, children }: { user: AuthUser; onSignOut: () => void; children: ReactNode }) {
  const events = usePoll(() => api.listEvents(), 30_000);
  const requested = useSearchParams().get("event");
  const list = events.data ?? [];
  const current = list.find((e) => e.id === requested) ?? list[0];

  if (!current)
    return (
      <div className="grid min-h-dvh place-items-center bg-zinc-50 px-4">
        {events.error ? (
          <Notice error={events.error} retryIn={events.retryIn} />
        ) : events.loading ? (
          <Skeleton className="h-64 w-full max-w-[1200px]" />
        ) : (
          <ErrorState title="No events yet" body="Create an event in the backend to open its dashboard." />
        )}
      </div>
    );
  return (
    <EventShell key={current.id} initial={current} events={list} user={user} onSignOut={onSignOut}>
      {children}
    </EventShell>
  );
}

/** Keyed by event id: switching events remounts every page, so local state and polls reset cleanly. */
function EventShell({
  initial,
  events,
  user,
  onSignOut,
  children,
}: {
  initial: EventInfo;
  events: EventInfo[];
  user: AuthUser;
  onSignOut: () => void;
  children: ReactNode;
}) {
  const eventId = initial.id;
  const poll = usePoll(() => api.getEvent(eventId), 3000);
  const [open, setOpen] = useState(false);
  const menuBtn = useRef<HTMLButtonElement>(null);
  const close = () => {
    setOpen(false);
    menuBtn.current?.focus();
  };

  return (
    <EventContext.Provider value={{ ...poll, eventId, event: poll.data ?? initial, events }}>
      <div className="min-h-dvh bg-zinc-50 text-zinc-900 lg:flex">
        {/* Dark zinc navigation sidebar */}
        <aside className="sticky top-0 hidden h-dvh w-64 shrink-0 flex-col justify-between border-r border-zinc-800/80 bg-zinc-950 px-5 py-7 text-zinc-300 lg:flex shadow-xl">
          <div className="grid gap-6">
            <div className="grid gap-5">
              <Link href={withEvent("/admin", eventId)} className="flex items-center justify-between px-1">
                <span className="inline-flex items-center gap-2 text-sm font-semibold tracking-tight uppercase text-white">
                  <span className="size-2 rounded-full bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.7)]" />
                  Fair Drop
                </span>
                <span className="rounded-full bg-zinc-900 border border-emerald-500/30 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-emerald-400">
                  Admin
                </span>
              </Link>
              <EventSwitcher id="event-switch" />
            </div>
            <Nav />
          </div>
          <Profile user={user} onSignOut={onSignOut} />
        </aside>

        {/* Mobile header */}
        <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-zinc-800/80 bg-zinc-950 px-4 text-zinc-200 lg:hidden">
          <Link href={withEvent("/admin", eventId)} className="inline-flex items-center gap-2 text-xs font-semibold tracking-tight uppercase text-white">
            <span className="size-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.7)]" />
            Fair Drop Admin
          </Link>
          <button
            ref={menuBtn}
            onClick={() => setOpen(true)}
            aria-expanded={open}
            aria-controls="admin-drawer"
            className="h-8 rounded-full border border-zinc-800 bg-zinc-900 px-3.5 text-xs font-medium text-zinc-200 hover:bg-zinc-800"
          >
            Menu
          </button>
        </header>
        <Drawer open={open} onClose={close}>
          <EventSwitcher id="event-switch-mobile" />
          <Nav onNavigate={() => setOpen(false)} />
          <div className="mt-auto">
            <Profile user={user} onSignOut={onSignOut} />
          </div>
        </Drawer>

        <main className="min-w-0 flex-1 px-4 py-8 sm:px-8 lg:px-12 lg:py-10">
          <div className="mx-auto max-w-[1240px]">{children}</div>
        </main>
      </div>
    </EventContext.Provider>
  );
}

export default function AdminLayout({ children }: { children: ReactNode }) {
  const { user, loading, signIn, signOut } = useAuth();
  const canDemo = API_MODE === "mock" && (!user || user.mock);
  const pathname = usePathname();

  if (loading)
    return (
      <div className="grid min-h-dvh gap-4 bg-zinc-50 p-12">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-64" />
      </div>
    );

  if (!user?.isAdmin)
    return (
      <main className="grid min-h-dvh place-items-center bg-zinc-50 px-4">
        <div className="w-full max-w-sm rounded-3xl border border-zinc-200/80 bg-white p-8 shadow-sm text-center">
          <div className="mb-6 flex justify-center">
            <span className="inline-flex items-center gap-2 text-sm font-semibold tracking-tight uppercase text-zinc-900">
              <span className="size-2.5 rounded-full bg-emerald-600 shadow-[0_0_8px_rgba(5,150,105,0.5)]" />
              Fair Drop Admin
            </span>
          </div>
          <ErrorState
            title="Admins only"
            body={user ? "You're signed in, but this account doesn't have the admin role." : "Sign in with an admin account to open the dashboard."}
            action={canDemo ? <Button variant="primary" onClick={() => signIn("/admin", true)}>Continue as demo admin</Button> : !user ? <Button variant="primary" onClick={() => signIn("/admin")}>Sign in with Google</Button> : <Button onClick={() => window.location.reload()}>Check access again</Button>}
          />
        </div>
      </main>
    );

  return (
    <Suspense fallback={<div className="min-h-dvh bg-zinc-50" />}>
      <Shell user={user} onSignOut={signOut}>
        {API_MODE === "live" && pathname !== "/admin" ? <ErrorState title="Demo feature" body="Use the live allocation dashboard to manage this event." action={<Link href="/admin" className="underline">Go to live dashboard</Link>} /> : children}
      </Shell>
    </Suspense>
  );
}
