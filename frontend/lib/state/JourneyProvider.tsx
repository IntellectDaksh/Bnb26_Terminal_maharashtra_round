"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import type { EventInfo, Me } from "@/lib/contracts";
import { api, ApiError } from "@/lib/api";
import { subscribe, type ConnStatus } from "@/lib/realtime";
import { reconcile } from "./journey";

type Journey = {
  eventId: string;
  me?: Me;
  event?: EventInfo;
  conn: ConnStatus;
  error?: ApiError;
  /** True when this page load picked up an existing entry (refresh, new tab, new device). */
  restored: boolean;
  /** Re-read /me now (after an action, on focus, on reconnect). */
  refresh: () => Promise<void>;
  /** Apply a /me returned directly by an action (register/confirm). */
  setMe: (me: Me) => void;
};

const Ctx = createContext<Journey | null>(null);

export function JourneyProvider({ eventId, children }: { eventId: string; children: ReactNode }) {
  const [me, setMeState] = useState<Me>();
  const [event, setEvent] = useState<EventInfo>();
  const [conn, setConn] = useState<ConnStatus>("connecting");
  const [error, setError] = useState<ApiError>();
  const lastReceived = useRef(0);
  const inflight = useRef<Promise<void> | null>(null);
  const phase = useRef<string>(undefined);
  const first = useRef(true);
  const [restored, setRestored] = useState(false);

  const accept = useCallback((next: Me, sentAt: number) => {
    const fresh = sentAt >= lastReceived.current;
    lastReceived.current = Date.now();
    if (first.current) {
      first.current = false;
      if (next.status !== "NOT_REGISTERED") setRestored(true);
    }
    setMeState((prev) => reconcile(prev, next, fresh));
    setError(undefined);
  }, []);

  const refresh = useCallback(() => {
    // single in-flight request: focus + online + reconnect firing together = one call
    inflight.current ??= (async () => {
      const sentAt = Date.now();
      try {
        const [m, e] = await Promise.all([api.getMe(eventId), api.getEvent(eventId)]);
        accept(m, sentAt);
        setEvent(e);
      } catch (err) {
        if (err instanceof ApiError) setError(err);
      } finally {
        inflight.current = null;
      }
    })();
    return inflight.current;
  }, [accept, eventId]);

  useEffect(() => {
    const unsub = subscribe(eventId, {
      onStatus: setConn,
      onError: setError,
      onEvent: (e) => {
        // pushed updates may race an action's response, so they only move forward;
        // explicit refresh() (fresh) is allowed to move backwards (e.g. admin reset)
        if (e.type === "me") accept(e.me, -1);
        if (e.type === "event") {
          if (phase.current && phase.current !== e.event.phase) void refresh();
          phase.current = e.event.phase;
          setEvent(e.event);
        }
        if (e.type === "phase") void refresh();
      },
    });
    const onVisible = () => document.visibilityState === "visible" && void refresh();
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("online", refresh);
    window.addEventListener("focus", onVisible);
    return () => {
      unsub();
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("online", refresh);
      window.removeEventListener("focus", onVisible);
    };
  }, [accept, refresh, eventId]);

  const setMe = useCallback((m: Me) => accept(m, Date.now()), [accept]);

  return <Ctx.Provider value={{ eventId, me, event, conn, error, restored, refresh, setMe }}>{children}</Ctx.Provider>;
}

export function useJourney() {
  const v = useContext(Ctx);
  if (!v) throw new Error("useJourney must be used inside <JourneyProvider>");
  return v;
}
