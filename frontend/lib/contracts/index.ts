import { z } from "zod";

// Presentation contracts shared by the UI and demo. The PRD API is validated
// separately in lib/api/backend-contracts.ts and mapped by lib/api/live.ts.

export const Phase = z.enum([
  "DRAFT",
  "REGISTRATION_OPEN",
  "REGISTRATION_CLOSED",
  "QUEUE_READY",
  "ADMITTING",
  "SOLD_OUT",
  "ENDED",
]);
export type Phase = z.infer<typeof Phase>;

const iso = z.string(); // ISO-8601 timestamps

export const EventCategory = z.enum(["hackathon", "concert", "film", "conference", "comedy", "workshop", "sports"]);
export type EventCategory = z.infer<typeof EventCategory>;

export const EventInfo = z.object({
  id: z.string(), // url-safe slug
  name: z.string(),
  tagline: z.string(),
  description: z.string(),
  category: EventCategory,
  organizer: z.string(),
  city: z.string(),
  venue: z.string(),
  starts_at: iso,
  ends_at: iso,
  price_inr: z.number().int(), // 0 = free
  reservation_window_s: z.number().int(),
  registration_closes_at: iso.optional(),
  phase: Phase,
  seats_total: z.number().int(),
  seats_confirmed: z.number().int(),
  seats_reserved: z.number().int(),
  registrations: z.number().int(),
  server_time: iso,
});
export type EventInfo = z.infer<typeof EventInfo>;
export const EventList = z.object({ events: z.array(EventInfo) });

export const Ticket = z.object({
  ticket_id: z.string(),
  seat_label: z.string(),
  holder_name: z.string(),
  confirmed_at: iso,
});
export type Ticket = z.infer<typeof Ticket>;

export const Me = z.discriminatedUnion("status", [
  z.object({ status: z.literal("NOT_REGISTERED") }),
  z.object({ status: z.literal("REGISTERED"), entry_id: z.string(), registered_at: iso }),
  z.object({
    status: z.literal("QUEUED"),
    entry_id: z.string(),
    position: z.number().int(),
    total: z.number().int(),
    admitted_ahead: z.number().int().optional(), // how many people ahead have been admitted so far
  }),
  z.object({
    status: z.literal("ADMITTED"),
    entry_id: z.string(),
    reservation_id: z.string(),
    expires_at: iso,
  }),
  z.object({ status: z.literal("CONFIRMED"), entry_id: z.string(), ticket: Ticket }),
  z.object({ status: z.literal("EXPIRED"), entry_id: z.string() }),
  z.object({ status: z.literal("INELIGIBLE"), reason: z.string() }),
  z.object({ status: z.literal("SOLD_OUT"), entry_id: z.string().optional() }),
]);
export type Me = z.infer<typeof Me>;
export type MeStatus = Me["status"];

/** One row per event the signed-in user has an entry for (My tickets). */
export const MyEntries = z.object({ entries: z.array(z.object({ event: EventInfo, me: Me })) });
export type MyEntries = z.infer<typeof MyEntries>;

export const RegisterRequest = z.object({
  turnstile_token: z.string().min(1),
  idempotency_key: z.string().min(8),
  full_name: z.string().min(1).max(120),
  organization: z.string().min(1).max(160),
  eligibility_confirmed: z.literal(true),
});
export type RegisterRequest = z.infer<typeof RegisterRequest>;

export const RegisterResponse = z.object({ created: z.boolean(), me: Me });
export type RegisterResponse = z.infer<typeof RegisterResponse>;

export const ConfirmRequest = z.object({ idempotency_key: z.string().min(8) });
export const ConfirmResponse = z.object({ me: Me });
export type ConfirmResponse = z.infer<typeof ConfirmResponse>;

export const ApiErrorBody = z.object({
  code: z.string(),
  message: z.string(),
  retry_after: z.number().optional(), // seconds
});
export type ApiErrorBody = z.infer<typeof ApiErrorBody>;

// Realtime events (SSE `data:` payloads / WebSocket messages)
export const StreamEvent = z.discriminatedUnion("type", [
  z.object({ type: z.literal("phase"), phase: Phase }),
  z.object({ type: z.literal("me"), me: Me }),
  z.object({ type: z.literal("event"), event: EventInfo }),
  z.object({ type: z.literal("ping"), server_time: iso }),
]);
export type StreamEvent = z.infer<typeof StreamEvent>;

// ---------- Admin ----------

export const MetricsSnapshot = z.object({
  t: iso,
  rps: z.number(),
  allowed_rps: z.number(),
  blocked_rps: z.number(),
  active_sessions: z.number().int(),
  latency_p50: z.number(),
  latency_p95: z.number(),
  latency_p99: z.number(),
  error_rate: z.number(), // 0..1
  turnstile_pass: z.number().int(),
  turnstile_fail: z.number().int(),
  rate_limited: z.number().int(),
  flagged_sessions: z.number().int(),
  seats_confirmed: z.number().int(),
  seats_reserved: z.number().int(),
  reservations_expired: z.number().int(),
  admission_batch: z.number().int(),
  duplicate_allocations: z.number().int(), // must be 0
  oversold: z.number().int(), // must be 0
  phase: Phase,
});
export type MetricsSnapshot = z.infer<typeof MetricsSnapshot>;

export const AdminMetrics = z.object({ current: MetricsSnapshot, history: z.array(MetricsSnapshot) });
export type AdminMetrics = z.infer<typeof AdminMetrics>;

export const BotProfile = z.enum(["naive_spammer", "fast_refresher", "multi_account", "headless_solver", "distributed"]);
export type BotProfile = z.infer<typeof BotProfile>;

export const AttackEvent = z.object({
  id: z.string(),
  t: iso,
  profile: BotProfile,
  session_id: z.string(),
  action: z.enum(["rate_limited", "turnstile_failed", "duplicate_identity", "flagged", "blocked_ip", "allowed"]),
  detail: z.string(),
});
export type AttackEvent = z.infer<typeof AttackEvent>;

export const AttackSummary = z.object({
  events: z.array(AttackEvent),
  by_profile: z.array(
    z.object({ profile: BotProfile, requests: z.number(), blocked: z.number(), seats_won: z.number().int() }),
  ),
});
export type AttackSummary = z.infer<typeof AttackSummary>;

export const Allocation = z.object({
  t: iso,
  confirmed: z.number().int(),
  reserved: z.number().int(),
  expired: z.number().int(),
});
export const Allocations = z.object({
  seats_total: z.number().int(),
  timeline: z.array(Allocation),
  batches: z.array(z.object({ batch: z.number().int(), size: z.number().int(), admitted_at: iso, confirmed: z.number().int(), expired: z.number().int() })),
  integrity: z.object({ duplicate_allocations: z.number().int(), oversold: z.number().int(), checked_at: iso }),
});
export type Allocations = z.infer<typeof Allocations>;

export const SimParams = z.object({
  humans: z.number().int().min(0),
  bots: z.number().int().min(0),
  bot_rps: z.number().min(0), // requests/sec per bot
  seats: z.number().int().min(1),
  profiles: z.array(BotProfile).min(1),
  seed: z.number().int().optional(),
  traffic_profile: z.enum(["normal", "high_traffic", "adversarial"]).optional(),
  duration_s: z.number().int().min(1).max(3600).optional(),
});
export type SimParams = z.infer<typeof SimParams>;

export const CohortResult = z.object({
  cohort: z.string(), // human_slow | human_avg | human_fast | bot
  participants: z.number().int(),
  seats: z.number().int(),
  win_rate: z.number(),
});
export const StrategyResult = z.object({
  strategy: z.enum(["fifo", "protected"]),
  bot_seat_share: z.number(),
  human_seat_share: z.number(),
  jain_index: z.number(),
  cohorts: z.array(CohortResult),
  time_to_allocation_ms: z.object({ p50: z.number(), p95: z.number(), histogram: z.array(z.object({ bucket: z.string(), humans: z.number(), bots: z.number() })) }),
});
export type StrategyResult = z.infer<typeof StrategyResult>;

export const ComparisonRow = z.object({
  condition: z.string(),
  bots: z.number().int(),
  bot_rps: z.number(),
  fifo_bot_share: z.number(),
  protected_bot_share: z.number(),
  fifo_jain: z.number(),
  protected_jain: z.number(),
});
export type ComparisonRow = z.infer<typeof ComparisonRow>;
export const Comparison = z.object({
  params: SimParams,
  fifo: StrategyResult,
  protected: StrategyResult,
  conditions: z.array(ComparisonRow),
});
export type Comparison = z.infer<typeof Comparison>;

export const AuditEntry = z.object({
  id: z.string(),
  t: iso,
  kind: z.enum(["phase_change", "admission", "reservation", "confirmation", "expiry", "attack", "admin_action"]),
  actor: z.string(),
  message: z.string(),
});
export type AuditEntry = z.infer<typeof AuditEntry>;
export const AuditLog = z.object({ entries: z.array(AuditEntry) });

export const AdminAction = z.enum(["open-registration", "close-registration", "generate-queue", "start-admission", "pause", "reset"]);
export type AdminAction = z.infer<typeof AdminAction>;

export const SimRunResponse = z.object({ run_id: z.string(), accepted: z.boolean() });
