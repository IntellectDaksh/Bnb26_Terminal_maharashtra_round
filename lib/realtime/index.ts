import { StreamEvent } from "@/lib/contracts";
import { api, API_MODE, backoff } from "@/lib/api";
import { API_BASE } from "@/lib/api/live";
import { accessToken } from "@/lib/supabase/client";
import { MOCK_PREFIX } from "@/lib/api/mock";

export type ConnStatus = "connecting" | "live" | "reconnecting" | "offline";
type Handlers = { onEvent: (e: StreamEvent) => void; onStatus: (s: ConnStatus) => void };

/**
 * One interface, three transports:
 *  - live: SSE over fetch (so we can send the Bearer token), jittered reconnect,
 *    and a GET /me poll on every gap so the UI never sits on stale state.
 *  - mock: 1s poll of the in-browser backend + cross-tab `storage` events.
 * Returns an unsubscribe function.
 */
export function subscribe(eventId: string, h: Handlers): () => void {
  return API_MODE === "live" ? subscribeSse(eventId, h) : subscribePoll(eventId, h, 1000);
}

function subscribePoll(eventId: string, { onEvent, onStatus }: Handlers, everyMs: number) {
  let stopped = false;
  let fails = 0;
  let timer: ReturnType<typeof setTimeout>;
  const run = async () => {
    if (stopped) return;
    try {
      const [me, event] = await Promise.all([api.getMe(eventId), api.getEvent(eventId)]);
      if (stopped) return;
      fails = 0;
      onStatus("live");
      onEvent({ type: "me", me });
      onEvent({ type: "event", event });
    } catch {
      fails++;
      onStatus(navigator.onLine ? "reconnecting" : "offline");
    }
    timer = setTimeout(run, fails ? Math.max(everyMs, backoff(fails, 1000, 15_000)) : everyMs);
  };
  const nudge = (e: StorageEvent) => {
    if (e.key === MOCK_PREFIX + eventId) {
      clearTimeout(timer);
      run();
    }
  };
  window.addEventListener("storage", nudge);
  onStatus("connecting");
  run();
  return () => {
    stopped = true;
    clearTimeout(timer);
    window.removeEventListener("storage", nudge);
  };
}

function subscribeSse(eventId: string, { onEvent, onStatus }: Handlers) {
  let stopped = false;
  let ctrl: AbortController | null = null;
  let attempt = 0;
  let wake: (() => void) | null = null;

  const sleep = (ms: number) =>
    new Promise<void>((r) => {
      const t = setTimeout(r, ms);
      wake = () => {
        clearTimeout(t);
        r();
      };
    });

  const poll = async () => {
    try {
      onEvent({ type: "me", me: await api.getMe(eventId) });
    } catch {
      // still down; next loop iteration retries
    }
  };

  const loop = async () => {
    while (!stopped) {
      ctrl = new AbortController();
      try {
        const token = await accessToken();
        const res = await fetch(`${API_BASE}/events/${encodeURIComponent(eventId)}/stream`, {
          headers: { Accept: "text/event-stream", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
          signal: ctrl.signal,
          cache: "no-store",
        });
        if (!res.ok || !res.body) throw new Error(`stream ${res.status}`);
        attempt = 0;
        onStatus("live");
        await poll(); // reconcile anything missed while disconnected
        const reader = res.body.pipeThrough(new TextDecoderStream()).getReader();
        let buf = "";
        for (;;) {
          const { value, done } = await reader.read();
          if (done) break;
          buf += value;
          let i;
          while ((i = buf.indexOf("\n\n")) >= 0) {
            const frame = buf.slice(0, i);
            buf = buf.slice(i + 2);
            const data = frame
              .split("\n")
              .filter((l) => l.startsWith("data:"))
              .map((l) => l.slice(5).trimStart())
              .join("\n");
            if (!data) continue;
            try {
              const ev = StreamEvent.safeParse(JSON.parse(data));
              if (ev.success) onEvent(ev.data);
            } catch {
              // ignore malformed frame
            }
          }
        }
      } catch {
        // network error or abort; fall through to reconnect
      }
      if (stopped) return;
      onStatus(navigator.onLine ? "reconnecting" : "offline");
      await poll(); // polling fallback during the gap
      await sleep(backoff(attempt++, 1000, 30_000));
    }
  };

  const online = () => wake?.();
  window.addEventListener("online", online);
  onStatus("connecting");
  loop();
  return () => {
    stopped = true;
    ctrl?.abort();
    wake?.();
    window.removeEventListener("online", online);
  };
}
