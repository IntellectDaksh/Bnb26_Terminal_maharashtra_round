import type { Me, MeStatus } from "@/lib/contracts";

// GET /me is the only thing that decides which screen a participant sees.

/** Screen within an event: /events/:id/<step> */
export type Route = "register" | "queue" | "reservation" | "confirmed" | "ticket" | "status";

export const ROUTE_FOR: Record<MeStatus, Route> = {
  NOT_REGISTERED: "register",
  REGISTERED: "queue",
  QUEUED: "queue",
  ADMITTED: "reservation",
  CONFIRMED: "confirmed",
  EXPIRED: "status",
  INELIGIBLE: "status",
  SOLD_OUT: "status",
};

export const routeFor = (me: Me): Route => ROUTE_FOR[me.status];
export const eventPath = (eventId: string, step?: Route) => `/events/${encodeURIComponent(eventId)}${step ? `/${step}` : ""}`;
export const pathFor = (eventId: string, me: Me) => eventPath(eventId, routeFor(me));

/** Statuses that never change again for this participant. */
export const isFinal = (me: Me) => me.status === "CONFIRMED" || me.status === "EXPIRED" || me.status === "INELIGIBLE";

const ORDER: Record<MeStatus, number> = {
  NOT_REGISTERED: 0,
  INELIGIBLE: 0,
  REGISTERED: 1,
  QUEUED: 2,
  ADMITTED: 3,
  CONFIRMED: 4,
  EXPIRED: 4,
  SOLD_OUT: 4,
};

/**
 * Merge an incoming /me with what we show. Server wins, except a stale
 * response (sent before a newer one landed) must not move the user backwards
 * — e.g. a slow poll returning QUEUED after the stream already said ADMITTED.
 * `fresh` = response to a request started after `prev` was received.
 */
export function reconcile(prev: Me | undefined, next: Me, fresh: boolean): Me {
  if (!prev || fresh) return next;
  return ORDER[next.status] < ORDER[prev.status] ? prev : next;
}

/** "About N min" style estimate. Returns null when we can't say anything honest. */
export function etaText(position: number, admittedAhead: number | undefined, ratePerSec: number | null) {
  const remaining = position - 1 - (admittedAhead ?? 0);
  if (remaining <= 0) return "You're next";
  if (!ratePerSec || ratePerSec <= 0) return null;
  const s = remaining / ratePerSec;
  if (s < 60) return "Under a minute";
  const lo = Math.max(1, Math.floor((s * 0.8) / 60));
  const hi = Math.ceil((s * 1.3) / 60);
  return lo === hi ? `About ${lo} min` : `Roughly ${lo}-${hi} min`;
}
