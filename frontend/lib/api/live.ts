import { z } from "zod";
import { ApiErrorBody } from "@/lib/contracts";
import { accessToken, supabaseBrowser } from "@/lib/supabase/client";
import {
  AdminSnapshot, BackendConfirmation, BackendEvent, BackendRegisterResult,
  PublicEvent, QueueStatus, eventForUi, statusForUi,
} from "./backend-contracts";
import { recordServerTime } from "@/lib/time";
import { ApiError, type Api } from "./types";

export const API_BASE = (process.env.NEXT_PUBLIC_API_BASE_URL ?? "").replace(/\/$/, "");

export async function request<T>(path: string, schema: z.ZodType<T>, init: RequestInit = {}): Promise<T> {
  const token = await accessToken();
  const headers = new Headers(init.headers);
  if (token) headers.set("Authorization", `Bearer ${token}`);
  if (init.body) headers.set("Content-Type", "application/json");
  let res: Response;
  try {
    res = await fetch(`${API_BASE}${path}`, { ...init, headers, cache: "no-store" });
  } catch {
    throw new ApiError(0, "network", "Can't reach the server.");
  }
  const body = await res.json().catch(() => null);
  if (!res.ok) {
    const err = ApiErrorBody.safeParse(body);
    const retryHeader = Number(res.headers.get("Retry-After"));
    throw new ApiError(
      res.status,
      err.success ? err.data.code : `http_${res.status}`,
      err.success ? err.data.message : res.statusText || "Request failed",
      err.success && err.data.retry_after !== undefined ? err.data.retry_after : retryHeader || undefined,
    );
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    console.error(`[api] ${path} response does not match contract`, parsed.error.issues);
    throw new ApiError(res.status, "contract_mismatch", "Unexpected response from server.");
  }
  return parsed.data;
}

const post = (body: unknown, key?: string): RequestInit => ({
  method: "POST",
  body: JSON.stringify(body ?? {}),
  headers: key ? { "Idempotency-Key": key } : undefined,
});
const ev = (id: string) => `/events/${encodeURIComponent(id)}`;

export const getAdminStatus = (id: string) => request(`/admin${ev(id)}/status`, AdminSnapshot);
export async function liveAdminAction(id: string, action: "open" | "close" | "draw") {
  await request(`/admin${ev(id)}/${action}`, BackendEvent, post({}));
}
const unsupported = async (): Promise<never> => {
  throw new ApiError(501, "unsupported_feature", "This feature is available only in the demo. Use the live allocation dashboard.");
};

export const liveApi: Api = {
  listEvents: async () => (await request("/events", z.array(PublicEvent))).map(eventForUi),
  async getEvent(id) {
    const t0 = Date.now();
    const e = eventForUi(await request(ev(id), PublicEvent));
    recordServerTime(e.server_time, t0, Date.now());
    return e;
  },
  async getMe(id) {
    const t0 = Date.now();
    const [q, event, identity] = await Promise.all([
      request(`${ev(id)}/me`, QueueStatus), request(ev(id), PublicEvent),
      supabaseBrowser()?.auth.getSession(),
    ]);
    recordServerTime(q.server_time, t0, Date.now());
    const user = identity?.data.session?.user;
    return statusForUi(q, event.registrations, user?.user_metadata?.full_name ?? user?.email ?? "Participant");
  },
  async myEntries() {
    const events = await liveApi.listEvents();
    const entries = await Promise.all(events.map(async (event) => ({ event, me: await liveApi.getMe(event.id) })));
    return entries.filter(({ me }) => me.status !== "NOT_REGISTERED");
  },
  async register(id, body) {
    const result = await request(`${ev(id)}/register`, BackendRegisterResult,
      post({ security_token: body.turnstile_token }, body.idempotency_key));
    return { created: result.created, me: await liveApi.getMe(id) };
  },
  async confirm(id) {
    await request(`${ev(id)}/confirm`, BackendConfirmation, post({}));
    return liveApi.getMe(id);
  },
  admin: {
    metrics: unsupported, comparison: unsupported, attacks: unsupported, allocations: unsupported,
    audit: unsupported, runSimulator: unsupported, stopSimulator: unsupported,
    action: async (id, action) => {
      if (action === "open-registration") return liveAdminAction(id, "open");
      if (action === "close-registration") return liveAdminAction(id, "close");
      if (action === "generate-queue") return liveAdminAction(id, "draw");
      return unsupported();
    },
  },
};
