import { StreamEvent } from "@/lib/contracts";
import { api, API_MODE, ApiError, backoff } from "@/lib/api";
import { MOCK_PREFIX } from "@/lib/api/mock";

export type ConnStatus = "connecting" | "live" | "reconnecting" | "offline";
type Handlers = { onEvent: (e: StreamEvent) => void; onStatus: (s: ConnStatus) => void; onError?: (e: ApiError) => void };

/** Authoritative snapshots: live polls every five seconds; demo polls every second. */
export function subscribe(eventId: string, h: Handlers): () => void {
  return subscribePoll(eventId, h, API_MODE === "live" ? 5000 : 1000);
}

function subscribePoll(eventId: string, { onEvent, onStatus, onError }: Handlers, everyMs: number) {
  let stopped = false;
  let running = false;
  let fails = 0;
  let timer: ReturnType<typeof setTimeout>;
  const run = async () => {
    if (stopped || running) return;
    running = true;
    try {
      const [me, event] = await Promise.allSettled([api.getMe(eventId), api.getEvent(eventId)]);
      if (stopped) return;
      if (event.status === "fulfilled") onEvent({ type: "event", event: event.value });
      if (me.status === "fulfilled") onEvent({ type: "me", me: me.value });
      const error = event.status === "rejected" ? event.reason : me.status === "rejected" ? me.reason : null;
      if (error instanceof ApiError) onError?.(error);
      if (error && !(event.status === "fulfilled" && error instanceof ApiError && error.status === 401)) throw error;
      if (stopped) return;
      fails = 0;
      onStatus("live");
    } catch {
      fails++;
      onStatus(navigator.onLine ? "reconnecting" : "offline");
    }
    running = false;
    if (stopped) return;
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

