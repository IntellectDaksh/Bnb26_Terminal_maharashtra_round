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

/** Quiet inline notice; stale data underneath stays visible. Modern glass styled. */
export function Notice({ error, retryIn }: { error: ApiError | null; retryIn?: number }) {
  if (!error) return null;
  const soft = error.status === 0 || error.status === 429;
  return (
    <div
      role="status"
      className={cx(
        "flex items-center gap-2.5 rounded-2xl border px-4 py-3 text-xs font-medium backdrop-blur-md shadow-sm transition-all",
        soft
          ? "border-amber-200/80 bg-amber-50/90 text-amber-800"
          : "border-red-200/80 bg-red-50/90 text-red-700"
      )}
    >
      <span
        className={cx(
          "size-2 rounded-full shrink-0",
          soft ? "bg-amber-500 animate-pulse" : "bg-red-500"
        )}
        aria-hidden
      />
      <span>{errorText(error, retryIn)}</span>
    </div>
  );
}

/* ---------- phase context (polled once, in the layout) ---------- */

export type EventPoll = PollState<EventInfo> & { refresh: () => void; eventId: string; event: EventInfo; events: EventInfo[] };
export const EventContext = createContext<EventPoll | null>(null);
export function useEventPoll() {
  const v = useContext(EventContext);
  if (!v) throw new Error("useEventPoll must be used inside the admin layout");
  return v;
}
export const isLivePhase = (p?: string) => p === "ADMITTING" || p === "REGISTRATION_OPEN";
export const phaseName = (p: string) => p.replace(/_/g, " ").toLowerCase().replace(/^\w/, (c) => c.toUpperCase());

/** Modern phase status pill with emerald/zinc accents */
export function PhaseBadge({ phase, className }: { phase: string; className?: string }) {
  const isLive = isLivePhase(phase);
  const isClosed = phase === "REGISTRATION_CLOSED";
  const isReady = phase === "QUEUE_READY";
  const isSoldOut = phase === "SOLD_OUT";
  const isEnded = phase === "ENDED";

  return (
    <span
      className={cx(
        "inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-wider transition-all",
        isLive && "bg-emerald-50 text-emerald-700 border border-emerald-200/80 shadow-[0_0_12px_rgba(5,150,105,0.15)]",
        isReady && "bg-zinc-100 text-zinc-800 border border-zinc-200",
        isClosed && "bg-amber-50 text-amber-700 border border-amber-200/80",
        (isSoldOut || isEnded) && "bg-zinc-100 text-zinc-500 border border-zinc-200/80",
        className
      )}
    >
      <span
        className={cx(
          "size-1.5 rounded-full shrink-0",
          isLive && "bg-emerald-500 pulse-dot",
          isReady && "bg-emerald-600",
          isClosed && "bg-amber-500",
          (isSoldOut || isEnded) && "bg-zinc-400"
        )}
        aria-hidden
      />
      {phaseName(phase)}
    </span>
  );
}

/* ---------- layout pieces ---------- */

/** Appends the selected event to an admin href so nav keeps `?event=`. */
export const withEvent = (href: string, eventId: string) => `${href}?event=${encodeURIComponent(eventId)}`;

export function PageHeader({
  title,
  subtitle,
  badge,
  right,
}: {
  title: ReactNode;
  subtitle?: string;
  badge?: ReactNode;
  right?: ReactNode;
}) {
  const { event: ev } = useEventPoll();
  return (
    <header className="mb-8 flex flex-wrap items-end justify-between gap-x-6 gap-y-4">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2.5">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wider text-emerald-700 border border-emerald-200/70">
            <span className="size-1.5 rounded-full bg-emerald-500" aria-hidden />
            {ev.name} · {ev.city}
          </span>
          {badge}
          {API_MODE === "mock" && (
            <span className="rounded-full bg-zinc-100 px-2.5 py-0.5 text-[11px] font-medium text-zinc-600 border border-zinc-200">
              Mock mode
            </span>
          )}
        </div>
        <h1 className="mt-3 text-3xl sm:text-4xl font-semibold tracking-tight text-zinc-900 leading-tight">
          {title}
        </h1>
        {subtitle && <p className="mt-1.5 max-w-2xl text-sm font-light text-zinc-500 leading-relaxed">{subtitle}</p>}
      </div>
      {right && <div className="flex flex-wrap items-center gap-2.5">{right}</div>}
    </header>
  );
}

export function Panel({
  title,
  subtitle,
  right,
  children,
  className,
}: {
  title: string;
  subtitle?: string;
  right?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cx("rounded-3xl border border-zinc-200/80 bg-white p-6 sm:p-8 shadow-sm transition-all", className)}>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-lg font-semibold tracking-tight text-zinc-900">{title}</h2>
          {subtitle && <p className="mt-1 text-xs font-light text-zinc-500">{subtitle}</p>}
        </div>
        {right}
      </div>
      {children}
    </div>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return <div className="grid min-h-28 place-items-center py-8 text-center text-sm font-light text-zinc-400">{children}</div>;
}

/** Horizontal scroll container for tables on narrow screens. */
export function TableWrap({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cx("overflow-x-auto rounded-2xl border border-zinc-200/70 bg-white shadow-sm", className)}>
      {children}
    </div>
  );
}
export const th = "border-b border-zinc-200/80 bg-zinc-50/75 px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-zinc-500 whitespace-nowrap";
export const td = "border-b border-zinc-100 px-5 py-3.5 text-sm text-zinc-800 last:border-b-0 whitespace-nowrap";

export function IntegrityLine({
  duplicates,
  oversold,
  className,
}: {
  duplicates: number;
  oversold: number;
  className?: string;
}) {
  const ok = duplicates === 0 && oversold === 0;
  return (
    <div
      role="status"
      aria-live="polite"
      className={cx(
        "inline-flex items-center gap-2 rounded-full px-3.5 py-1.5 text-xs font-semibold shadow-sm transition-all",
        ok
          ? "border border-emerald-200/80 bg-emerald-50 text-emerald-700"
          : "border border-red-200/80 bg-red-50 text-red-700",
        className
      )}
    >
      <span
        className={cx(
          "size-1.5 rounded-full shrink-0",
          ok ? "bg-emerald-500 pulse-dot" : "bg-red-500"
        )}
        aria-hidden
      />
      <span className="num">
        {ok ? "Integrity verified: " : "Integrity alert: "}
        {int(duplicates)} duplicate allocations · {int(oversold)} oversold
      </span>
    </div>
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
