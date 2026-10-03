import { z } from "zod";
import {
  AdminMetrics,
  Allocations,
  ApiErrorBody,
  AttackSummary,
  AuditLog,
  Comparison,
  ConfirmResponse,
  EventInfo,
  EventList,
  Me,
  MyEntries,
  RegisterResponse,
  SimRunResponse,
} from "@/lib/contracts";
import { accessToken } from "@/lib/supabase/client";
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
const Ok = z.unknown();

const ev = (id: string) => `/events/${encodeURIComponent(id)}`;

export const liveApi: Api = {
  listEvents: async () => (await request("/events", EventList)).events,
  async getEvent(id) {
    const t0 = Date.now();
    const e = await request(ev(id), EventInfo);
    recordServerTime(e.server_time, t0, Date.now());
    return e;
  },
  getMe: (id) => request(`${ev(id)}/me`, Me),
  myEntries: async () => (await request("/me/entries", MyEntries)).entries,
  register: (id, body) => request(`${ev(id)}/register`, RegisterResponse, post(body, body.idempotency_key)),
  confirm: async (id, rid, idempotency_key) =>
    (await request(`${ev(id)}/reservations/${encodeURIComponent(rid)}/confirm`, ConfirmResponse, post({ idempotency_key }, idempotency_key))).me,
  admin: {
    metrics: (id) => request(`/admin${ev(id)}/metrics`, AdminMetrics),
    comparison: (id, p) =>
      request(`/admin${ev(id)}/comparison?${new URLSearchParams(Object.entries(p).map(([k, v]) => [k, String(v)]))}`, Comparison),
    attacks: (id) => request(`/admin${ev(id)}/attacks`, AttackSummary),
    allocations: (id) => request(`/admin${ev(id)}/allocations`, Allocations),
    audit: async (id) => (await request(`/admin${ev(id)}/audit`, AuditLog)).entries,
    action: async (id, a) => void (await request(`/admin${ev(id)}/${a}`, Ok, post({}))),
    runSimulator: (id, p) => request(`/admin${ev(id)}/simulator/run`, SimRunResponse, post(p)),
    stopSimulator: async (id) => void (await request(`/admin${ev(id)}/simulator/stop`, Ok, post({}))),
  },
};
