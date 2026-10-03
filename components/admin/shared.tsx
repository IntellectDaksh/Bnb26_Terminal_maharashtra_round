"use client";

import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { API_MODE, ApiError, backoff } from "@/lib/api";
import type { AuditEntry, EventInfo, SimParams } from "@/lib/contracts";
import { Card, StatusBadge, cx } from "@/components/ui";

export type PollState<T> = { data: T | null; error: ApiError | null; loading: boolean; retryIn: number };

export const toApiError = (e: unknown) =>
  e instanceof ApiError ? e : new ApiError(0, "network", e instanceof Error ? e.message : "Network error");

/** Polls `fn` every `ms`. On failure it backs off (429 honours retry_after) and keeps the last good data. */
export function usePoll<T>(fn: () => Promise<T>, ms: number, deps: unknown[] = []): PollState<T> & { refresh: () => void } {
  const [s, setS] = useState<PollState<T>>({ data: null, error: null, loading: true, retryIn: 0 });
  const [nonce, setNonce] = useState(0);
  const fnRef = useRef(fn);
  useEffect(() => {
    fnRef.current = fn;
  });

  useEffect(() => {
    let alive = true;
    let timer: ReturnType<typeof setTimeout>;
    let attempt = 0;
    const tick = async () => {
      let wait = ms;
      try {
        const data = await fnRef.current();
        if (!alive) return;
        attempt = 0;
        setS({ data, error: null, loading: false, retryIn: 0 });
      } catch (e) {
        if (!alive) return;
        const err = toApiError(e);
        wait = err.status === 429 && err.retryAfter ? err.retryAfter * 1000 : Math.max(ms, backoff(attempt++));
        setS((p) => ({ ...p, error: err, loading: false, retryIn: Math.ceil(wait / 1000) }));
      }
      if (alive) timer = setTimeout(tick, wait);
    };
    tick();
    return () => {
      alive = false;
      clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ms, nonce, ...deps]);

  return { ...s, refresh: () => setNonce((n) => n + 1) };
}

export function errorText(e: ApiError, retryIn = 0) {
  if (e.status === 401 || e.status === 403) return "Admins only. This session doesn't have the admin role.";
  if (e.status === 429) return `Slow down, retrying in ${retryIn || e.retryAfter || 1}s.`;
  if (e.status === 0) return `Reconnecting${retryIn ? ` in ${retryIn}s` : ""}…`;
  return e.message || `Request failed (${e.status}).`;
}

/** Quiet inline notice; stale data underneath stays visible. */
export function Notice({ error, retryIn }: { error: ApiError | null; retryIn?: number }) {
  if (!error) return null;
  const soft = error.status === 0 || error.status === 429;
  return (
    <div role="status" className={cx("rounded-xl border bg-surface px-4 py-3 text-sm", soft ? "border-line text-muted" : "border-danger/30 text-danger")}>
      {errorText(error, retryIn)}
    </div>
  );
}

/* ---------- phase context (polled once, in the layout) ---------- */

/** `eventId` is always resolved by the time pages render (layout waits for listEvents). `event` = latest polled EventInfo. */
export type EventPoll = PollState<EventInfo> & { refresh: () => void; eventId: string; event: EventInfo; events: EventInfo[] };
export const EventContext = createContext<EventPoll | null>(null);
export function useEventPoll() {
  const v = useContext(EventContext);
  if (!v) throw new Error("useEventPoll must be used inside the admin layout");
  return v;
}
export const isLivePhase = (p?: string) => p === "ADMITTING" || p === "REGISTRATION_OPEN";
export const phaseName = (p: string) => p.replace(/_/g, " ").toLowerCase().replace(/^\w/, (c) => c.toUpperCase());

/* ---------- layout pieces ---------- */

/** Appends the selected event to an admin href so nav keeps `?event=`. */
export const withEvent = (href: string, eventId: string) => `${href}?event=${encodeURIComponent(eventId)}`;

export function PageHeader({ title, subtitle, badge, right }: { title: ReactNode; subtitle?: string; badge?: ReactNode; right?: ReactNode }) {
  const { event: ev } = useEventPoll();
  return (
    <header className="mb-10 flex flex-wrap items-end justify-between gap-x-6 gap-y-4">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <h1 className="display text-[38px] leading-[1.05] sm:text-[46px]">{title}</h1>
          {badge}
          {API_MODE === "mock" && <StatusBadge>Mock data</StatusBadge>}
        </div>
        {(
          <p className="mt-2 text-[13px] font-semibold text-accent">
            {ev.name} · {ev.city}
          </p>
        )}
        {subtitle && <p className="mt-2 max-w-xl text-[15px] text-muted">{subtitle}</p>}
      </div>
      {right && <div className="flex flex-wrap gap-2">{right}</div>}
    </header>
  );
}

export function Panel({ title, subtitle, right, children, className }: { title: string; subtitle?: string; right?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <Card className={cx("min-w-0 p-6 sm:p-8", className)}>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="serif text-[22px] font-semibold leading-tight">{title}</h2>
          {subtitle && <p className="mt-1 text-[13px] text-muted">{subtitle}</p>}
        </div>
        {right}
      </div>
      {children}
    </Card>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return <div className="grid min-h-24 place-items-center py-6 text-center text-sm text-muted">{children}</div>;
}

/** Horizontal scroll container for tables on narrow screens. */
export function TableWrap({ children }: { children: ReactNode }) {
  return <div className="-mx-6 overflow-x-auto px-6 sm:-mx-8 sm:px-8">{children}</div>;
}
export const th = "border-b border-line pb-3 pr-6 text-left text-[12px] font-medium text-muted last:pr-0";
export const td = "border-b border-line py-3 pr-6 text-sm last:pr-0";

export function IntegrityLine({ duplicates, oversold, className }: { duplicates: number; oversold: number; className?: string }) {
  const ok = duplicates === 0 && oversold === 0;
  return (
    <p role="status" aria-live="polite" className={cx("num text-[15px] font-medium", ok ? "text-success" : "text-danger", className)}>
      {int(duplicates)} duplicate allocations · {int(oversold)} oversold
    </p>
  );
}

/* ---------- formatting ---------- */

export const pct = (x: number, d = 1) => `${(x * 100).toFixed(d)}%`;
export const int = (x: number) => Math.round(x).toLocaleString("en-US");
export const hhmm = (iso: string) => new Date(iso).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", hour12: false });
export const hhmmss = (iso: string) => new Date(iso).toLocaleTimeString("en-GB", { hour12: false });
export const ms = (x: number) => (x >= 1000 ? `${(x / 1000).toFixed(x >= 10_000 ? 0 : 1)}s` : `${Math.round(x)}ms`);

export const AUDIT_LABEL: Record<AuditEntry["kind"], string> = {
  confirmation: "Seat confirmed",
  expiry: "Reservation expired",
  attack: "Blocked attempt",
  phase_change: "Phase changed",
  admin_action: "Admin action",
  admission: "Batch admitted",
  reservation: "Seat reserved",
};

export const PROFILE_LABEL: Record<string, string> = {
  naive_spammer: "Naive spammer",
  fast_refresher: "Fast refresher",
  multi_account: "Multi-account",
  headless_solver: "Headless solver",
  distributed: "Distributed",
};

export function download(name: string, blob: Blob) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

/** Scales the original 45k humans / 5k bots for 500 seats brief (90x / 10x demand) to the event's capacity. */
export const defaultParams = (seats: number): SimParams => ({
  humans: seats * 90,
  bots: seats * 10,
  bot_rps: 20,
  seats,
  profiles: ["naive_spammer", "fast_refresher", "multi_account", "headless_solver", "distributed"],
  seed: 42,
});
