"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useRef, useState, type ReactNode } from "react";
import type { EventInfo } from "@/lib/contracts";
import { API_MODE, api } from "@/lib/api";
import { useAuth, type AuthUser } from "@/lib/auth";
import { Button, ErrorState, Skeleton, StatusBadge, Wordmark, cx } from "@/components/ui";
import { EventContext, Notice, isLivePhase, phaseName, usePoll, useEventPoll, withEvent } from "@/components/admin/shared";

const NAV = [
  ["/admin", "Dashboard"],
  ["/admin/queue", "Queue"],
  ["/admin/traffic", "Traffic"],
  ["/admin/reservations", "Reservations"],
  ["/admin/security", "Security"],
  ["/admin/settings", "Settings"],
] as const;

function PhaseStatus() {
  const { data } = useEventPoll();
  if (!data) return <Skeleton className="h-4 w-24" />;
  return isLivePhase(data.phase) ? <StatusBadge tone="live">Event live</StatusBadge> : <StatusBadge>{phaseName(data.phase)}</StatusBadge>;
}

function EventSwitcher({ id }: { id: string }) {
  const { eventId, events } = useEventPoll();
  const router = useRouter();
  const path = usePathname();
  return (
    <div className="grid gap-1.5 px-1">
      <label htmlFor={id} className="eyebrow px-2">
        Event
      </label>
      <div className="relative">
        <select
          id={id}
          value={eventId}
          onChange={(e) => router.replace(withEvent(path, e.target.value))}
          className="h-10 w-full cursor-pointer appearance-none truncate rounded-full border border-line bg-surface pl-4 pr-9 text-[14px] font-semibold text-fg shadow-[var(--shadow-soft)] outline-none transition-colors hover:border-accent/50 focus-visible:ring-2 focus-visible:ring-accent/40"
        >
          {events.map((e) => (
            <option key={e.id} value={e.id}>
              {e.name} · {e.city}
            </option>
          ))}
        </select>
        <span aria-hidden className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-[10px] text-muted">
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
    <nav aria-label="Admin">
      <ul className="grid gap-0.5">
        {NAV.map(([href, label]) => {
          const active = href === "/admin" ? path === href : path.startsWith(href);
          return (
            <li key={href}>
              <Link
                href={withEvent(href, eventId)}
                onClick={onNavigate}
                aria-current={active ? "page" : undefined}
                className={cx(
                  "block rounded-full px-4 py-2 text-[14px] transition-colors",
                  active ? "bg-surface font-bold text-fg shadow-[var(--shadow-soft)]" : "text-muted hover:bg-surface/60 hover:text-fg",
                )}
              >
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

function Profile({ user, onSignOut }: { user: AuthUser; onSignOut: () => void }) {
  return (
    <div className="grid gap-4 border-t border-line pt-5">
      <PhaseStatus />
      <div className="flex items-end justify-between gap-3">
        <div className="min-w-0">
          <div className="truncate text-sm font-medium">{user.name}</div>
          <div className="truncate text-xs text-muted">{user.email}</div>
        </div>
        <button onClick={onSignOut} className="shrink-0 rounded-sm text-xs text-muted underline-offset-4 hover:text-fg hover:underline">
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
    // ponytail: focus trap-lite, wraps Tab at both ends; no inert on the page behind
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
      <div className="absolute inset-0 bg-fg/25" onClick={onClose} aria-hidden />
      <div ref={ref} id="admin-drawer" role="dialog" aria-modal="true" aria-label="Admin navigation" className="rise absolute inset-y-0 left-0 flex w-[280px] max-w-[85vw] flex-col gap-8 border-r border-line bg-bg-2 p-6">
        <div className="flex items-center justify-between">
          <Wordmark />
          <button onClick={onClose} className="rounded-full px-3 py-1 text-sm text-muted hover:bg-surface hover:text-fg">
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
  // unknown/missing ?event= falls back to the first event
  const current = list.find((e) => e.id === requested) ?? list[0];

  if (!current)
    return (
      <div className="grid min-h-dvh place-items-center bg-bg px-4">
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
function EventShell({ initial, events, user, onSignOut, children }: { initial: EventInfo; events: EventInfo[]; user: AuthUser; onSignOut: () => void; children: ReactNode }) {
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
      <div className="min-h-dvh bg-bg text-fg lg:flex">
        <aside className="sticky top-0 hidden h-dvh w-64 shrink-0 flex-col justify-between border-r border-line bg-bg-2 px-5 py-8 lg:flex">
          <div className="grid gap-8">
            <div className="grid gap-6">
              <Link href={withEvent("/admin", eventId)} className="rounded-full px-3">
                <Wordmark />
              </Link>
              <EventSwitcher id="event-switch" />
            </div>
            <Nav />
          </div>
          <Profile user={user} onSignOut={onSignOut} />
        </aside>

        <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-line bg-bg/90 px-4 backdrop-blur lg:hidden">
          <Link href={withEvent("/admin", eventId)} className="rounded-full">
            <Wordmark />
          </Link>
          <button
            ref={menuBtn}
            onClick={() => setOpen(true)}
            aria-expanded={open}
            aria-controls="admin-drawer"
            className="h-9 rounded-full border border-line bg-surface px-4 text-sm font-semibold"
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

        <main className="min-w-0 flex-1 px-4 py-8 sm:px-8 lg:px-12 lg:py-12">
          <div className="mx-auto max-w-[1200px]">{children}</div>
        </main>
      </div>
    </EventContext.Provider>
  );
}

/**
 * UI gate only: hides the dashboard from non-admins. Real enforcement is
 * proxy.ts (route guard) and the backend (role check on every /admin API call).
 */
export default function AdminLayout({ children }: { children: ReactNode }) {
  const { user, loading, signIn, signOut } = useAuth();
  const canDemo = API_MODE === "mock" && (!user || user.mock);

  if (loading)
    return (
      <div className="grid min-h-dvh gap-4 bg-bg p-12">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-64" />
      </div>
    );

  if (!user?.isAdmin)
    return (
      <main className="grid min-h-dvh place-items-center bg-bg px-4">
        <div>
          <div className="mb-10 flex justify-center">
            <Wordmark />
          </div>
          <ErrorState
            title="Admins only"
            body={user ? "You're signed in, but this account doesn't have the admin role." : "Sign in with an admin account to open the dashboard."}
            action={canDemo && <Button onClick={() => signIn("/admin", true)}>Continue as demo admin</Button>}
          />
        </div>
      </main>
    );

  return (
    <Suspense fallback={<div className="min-h-dvh bg-bg" />}>
      <Shell user={user} onSignOut={signOut}>
        {children}
      </Shell>
    </Suspense>
  );
}
