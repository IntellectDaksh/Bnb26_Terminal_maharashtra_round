"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ApiError } from "@/lib/api";

/**
 * One in-flight request per action, button locked while pending, and a
 * server-driven cool-down on 429. No automatic retries: a person presses again
 * when the cool-down ends, so the UI never generates a retry storm.
 */
export function useAction<A extends unknown[], R>(fn: (...args: A) => Promise<R>) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);
  const [retryIn, setRetryIn] = useState(0);
  const busy = useRef(false);

  useEffect(() => {
    if (retryIn <= 0) return;
    const t = setTimeout(() => setRetryIn((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [retryIn]);

  const run = useCallback(
    async (...args: A): Promise<R | undefined> => {
      if (busy.current) return;
      busy.current = true;
      setPending(true);
      setError(null);
      try {
        return await fn(...args);
      } catch (e) {
        const err = e instanceof ApiError ? e : new ApiError(0, "unknown", "Something went wrong.");
        setError(err);
        if (err.status === 429) setRetryIn(Math.max(1, Math.ceil(err.retryAfter ?? 10)));
      } finally {
        busy.current = false;
        setPending(false);
      }
    },
    [fn],
  );

  return { run, pending, error, retryIn, blocked: pending || retryIn > 0 };
}

/** Same key across refreshes and tabs, so a replayed submit is recognised as the same request. */
export function stableKey(scope: string) {
  const k = `fd.idem.${scope}`;
  try {
    let v = localStorage.getItem(k);
    if (!v) {
      v = crypto.randomUUID();
      localStorage.setItem(k, v);
    }
    return v;
  } catch {
    return crypto.randomUUID();
  }
}

export function errorCopy(e: ApiError, retryIn: number) {
  if (e.status === 429) return retryIn > 0 ? `Lots of traffic right now. You can try again in ${retryIn}s. Your place isn't affected.` : "You can try again now.";
  if (e.status === 0) return "Couldn't reach the server. Check your connection and try again.";
  if (e.status === 401) return "Your sign-in expired. Sign in again to continue.";
  if (e.status === 403) return "This account isn't allowed to do that.";
  if (e.status >= 500) return "The server hit a problem. Nothing was lost, try again in a moment.";
  return e.message;
}
