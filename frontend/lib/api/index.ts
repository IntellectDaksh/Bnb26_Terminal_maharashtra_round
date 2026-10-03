import { liveApi } from "./live";
import { mockApi } from "./mock";
import type { Api } from "./types";

export const API_MODE = process.env.NEXT_PUBLIC_API_MODE === "live" ? "live" : "mock";
export const api: Api = API_MODE === "live" ? liveApi : mockApi;
export { ApiError } from "./types";
export type { Api } from "./types";

export const newIdempotencyKey = () => crypto.randomUUID();

/** Jittered exponential backoff (full jitter), capped. attempt starts at 0. */
export function backoff(attempt: number, baseMs = 1000, capMs = 30_000) {
  return Math.random() * Math.min(capMs, baseMs * 2 ** attempt);
}
