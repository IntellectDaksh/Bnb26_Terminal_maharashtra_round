import type { AttackEvent, AuditEntry, BotProfile, EventInfo, Me, MetricsSnapshot, Phase, SimParams } from "@/lib/contracts";
import { compare, mulberry32 } from "@/lib/sim";
import { recordServerTime } from "@/lib/time";
import { CATALOG } from "./catalog";
import { ApiError, type Api } from "./types";

// In-browser fake backend, one independent drop per catalog event. State lives in
// localStorage so refresh, new tabs and reopened browsers all see the same entry.
// Queue movement is derived from timestamps, never client timers, so every tab agrees.

export const MOCK_PREFIX = "fd.mock.v3.";
const ADMIT_PER_SEC = 3.2; // queue positions admitted per second
const CONFIRM_PER_SEC = 1.2; // seats confirmed per second by everyone else
const BATCH = 50;

type MyEntry = {
  entryId: string;
  name?: string;
  registeredAt: number;
  position?: number;
  total?: number;
  confirmedAt?: number;
  ticketId?: string;
};

export type MockState = {
  eventId: string;
  phase: Phase;
  openedAt: number;
  closedAt?: number;
  admitElapsed: number; // ms of admission accumulated before runningSince
  runningSince?: number; // admission is running (not paused) since
  pausedAt?: number;
  me?: MyEntry;
  ineligible?: string;
  rateLimitedUntil?: number;
  offlineUntil?: number;
  attack?: { until: number; bots: number; bot_rps: number; profiles: BotProfile[] };
  schedule?: { phase: Phase; at: number }[];
  idem: Record<string, string>;
  audit: AuditEntry[];
};

const seed = (eventId: string) => {
  const c = CATALOG.find((e) => e.id === eventId);
  if (!c) throw new ApiError(404, "event_not_found", "This event doesn't exist.");
  return c;
};

/** Initial state for an event, matching the phase the catalog says it's in. */
function fresh(eventId: string, phase = seed(eventId).phase): MockState {
  const now = Date.now();
  const c = seed(eventId);
  const s: MockState = { eventId, phase, openedAt: now - 6 * 3600_000, admitElapsed: 0, idem: {}, audit: [] };
  if (phase !== "REGISTRATION_OPEN") s.closedAt = now - 15 * 60_000;
  if (phase === "ADMITTING") s.runningSince = now - 90_000;
  if (phase === "SOLD_OUT" || phase === "ENDED") {
    s.admitElapsed = (c.seats_total / CONFIRM_PER_SEC) * 1000;
    s.pausedAt = now - 3600_000;
  }
  return s;
}

const keyOf = (eventId: string) => MOCK_PREFIX + eventId;

function load(eventId: string): MockState {
  seed(eventId); // 404 for unknown ids
  if (typeof window === "undefined") return fresh(eventId);
  try {
    const raw = localStorage.getItem(keyOf(eventId));
    if (raw) return JSON.parse(raw) as MockState;
  } catch {
    // corrupt or blocked storage: start over
  }
  return fresh(eventId);
}

function save(s: MockState) {
  try {
    localStorage.setItem(keyOf(s.eventId), JSON.stringify(s));
  } catch {
    // storage full/blocked: state still works for this page view
  }
}

const id = (p: string) => `${p}_${Math.random().toString(36).slice(2, 10)}`;
const seats = (s: MockState) => seed(s.eventId).seats_total;

function log(s: MockState, kind: AuditEntry["kind"], actor: string, message: string, t = Date.now()) {
  s.audit.unshift({ id: id("aud"), t: new Date(t).toISOString(), kind, actor, message });
  s.audit.length = Math.min(s.audit.length, 300);
}

function setPhase(s: MockState, phase: Phase, actor = "admin", at = Date.now()) {
  if (s.phase === phase) return;
  if (phase === "REGISTRATION_CLOSED") s.closedAt = at;
  if (phase === "QUEUE_READY" && s.me && s.me.position === undefined) {
    s.me.total = registrations(s, at);
    // demo-friendly: land somewhere you'll be admitted in roughly 30-150s
    s.me.position = 80 + Math.floor(Math.random() * Math.min(400, seats(s)));
  }
  if (phase === "ADMITTING") s.runningSince = at;
  if (phase === "REGISTRATION_OPEN") s.openedAt = at;
  log(s, "phase_change", actor, `${s.phase} -> ${phase}`, at);
  s.phase = phase;
}

const elapsed = (s: MockState, now: number) => s.admitElapsed + (s.runningSince ? now - s.runningSince : 0);

function registrations(s: MockState, now: number) {
  const pool = seed(s.eventId).pool;
  const end = s.closedAt ?? now;
  return Math.min(pool, Math.floor(pool * 0.62 + ((end - s.openedAt) / 1000) * 0.6));
}

function seatsConfirmed(s: MockState, now: number) {
  const others = Math.floor((elapsed(s, now) / 1000) * CONFIRM_PER_SEC);
  return Math.min(seats(s), others + (s.me?.confirmedAt ? 1 : 0));
}

/** Apply scheduled phase changes and derived transitions (sold out). */
function tick(s: MockState, now = Date.now()) {
  while (s.schedule?.length && s.schedule[0].at <= now) {
    const next = s.schedule.shift()!;
    setPhase(s, next.phase, "demo timeline", next.at);
  }
  if (s.phase === "ADMITTING" && seatsConfirmed(s, now) >= seats(s)) {
    s.admitElapsed = elapsed(s, now);
    s.runningSince = undefined;
    s.pausedAt = now;
    setPhase(s, "SOLD_OUT", "system", now);
  }
}

function admitAt(s: MockState, pos: number): number | undefined {
  // wall-clock time my position was/will be reached; undefined if paused before reaching it
  const needMs = ((pos - 1) / ADMIT_PER_SEC) * 1000;
  const anchor = s.runningSince ?? s.pausedAt;
  if (anchor === undefined) return undefined;
  if (needMs <= s.admitElapsed) return anchor - (s.admitElapsed - needMs);
  return s.runningSince ? s.runningSince + (needMs - s.admitElapsed) : undefined;
}

function meOf(s: MockState, now = Date.now()): Me {
  if (s.ineligible) return { status: "INELIGIBLE", reason: s.ineligible };
  const m = s.me;
  const windowMs = seed(s.eventId).reservation_window_s * 1000;
  if (!m) return s.phase === "SOLD_OUT" || s.phase === "ENDED" ? { status: "SOLD_OUT" } : { status: "NOT_REGISTERED" };
  if (m.confirmedAt)
    return {
      status: "CONFIRMED",
      entry_id: m.entryId,
      ticket: {
        ticket_id: m.ticketId!,
        seat_label: `#${((m.position ?? 1) % seats(s)) + 1}`,
        holder_name: m.name ?? currentUserName(),
        confirmed_at: new Date(m.confirmedAt).toISOString(),
      },
    };
  if (m.position === undefined) return { status: "REGISTERED", entry_id: m.entryId, registered_at: new Date(m.registeredAt).toISOString() };
  if (s.phase === "QUEUE_READY" || s.phase === "REGISTRATION_CLOSED")
    return { status: "QUEUED", entry_id: m.entryId, position: m.position, total: m.total!, admitted_ahead: 0 };
  const at = admitAt(s, m.position);
  if (at !== undefined && at <= now) {
    const expires = at + windowMs;
    if (now > expires) return { status: "EXPIRED", entry_id: m.entryId };
    if (s.phase === "SOLD_OUT" && seatsConfirmed(s, now) >= seats(s)) return { status: "SOLD_OUT", entry_id: m.entryId };
    return { status: "ADMITTED", entry_id: m.entryId, reservation_id: `res_${m.entryId}`, expires_at: new Date(expires).toISOString() };
  }
  if (s.phase === "SOLD_OUT" || s.phase === "ENDED") return { status: "SOLD_OUT", entry_id: m.entryId };
  const ahead = Math.min(m.position - 1, Math.floor((elapsed(s, now) / 1000) * ADMIT_PER_SEC));
  return { status: "QUEUED", entry_id: m.entryId, position: m.position, total: m.total!, admitted_ahead: ahead };
}

function eventOf(s: MockState, now = Date.now()): EventInfo {
  const { pool: _pool, phase: _phase, ...meta } = seed(s.eventId);
  void _pool;
  void _phase;
  return {
    ...meta,
    phase: s.phase,
    seats_confirmed: seatsConfirmed(s, now),
    seats_reserved: s.phase === "ADMITTING" ? Math.min(BATCH, seats(s) - seatsConfirmed(s, now)) : 0,
    registrations: registrations(s, now),
    server_time: new Date(now).toISOString(),
  };
}

function currentUserName() {
  try {
    return JSON.parse(localStorage.getItem("fd.mock.user") ?? "{}").name ?? "Participant";
  } catch {
    return "Participant";
  }
}

// ---- request plumbing: latency, forced errors ----

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms + Math.random() * ms));

async function call<T>(eventId: string, fn: (s: MockState) => T, opts: { limited?: boolean } = {}): Promise<T> {
  await delay(120);
  const s = load(eventId);
  const now = Date.now();
  if (s.offlineUntil && now < s.offlineUntil) throw new ApiError(0, "network", "Can't reach the server.");
  if (opts.limited && s.rateLimitedUntil && now < s.rateLimitedUntil)
    throw new ApiError(429, "rate_limited", "Too many requests from this session.", Math.ceil((s.rateLimitedUntil - now) / 1000));
  tick(s, now);
  const out = fn(s);
  save(s); // tick may have changed state even on reads
  return out;
}

// ---- admin metrics (per-tab ring buffer per event, derived from shared state) ----

const histories = new Map<string, MetricsSnapshot[]>();
const totalsBy = new Map<string, { pass: number; fail: number; limited: number; flagged: number }>();

function snapshot(s: MockState, now: number): MetricsSnapshot {
  const rnd = mulberry32(Math.floor(now / 1000) + s.eventId.length);
  const attacking = s.attack && now < s.attack.until ? s.attack : undefined;
  const scale = seats(s) / 500;
  const base = (s.phase === "ADMITTING" ? 2_400 : s.phase === "REGISTRATION_OPEN" ? 900 : 300) * scale;
  const humanRps = base * (0.85 + rnd() * 0.3);
  const botRps = attacking ? Math.min(60_000, attacking.bots * attacking.bot_rps * (0.8 + rnd() * 0.4)) : rnd() * 40;
  const blocked = botRps * 0.97 + humanRps * 0.004;
  const t0 = totalsBy.get(s.eventId) ?? { pass: 0, fail: 0, limited: 0, flagged: 0 };
  const totals = {
    pass: t0.pass + Math.round(humanRps * 0.05),
    fail: t0.fail + Math.round(botRps * 0.02),
    limited: t0.limited + Math.round(botRps * 0.6),
    flagged: t0.flagged + (attacking ? Math.round(rnd() * 12) : 0),
  };
  totalsBy.set(s.eventId, totals);
  const load = (humanRps + botRps) / 20_000;
  const el = elapsed(s, now) / 1000;
  return {
    t: new Date(now).toISOString(),
    rps: humanRps + botRps,
    allowed_rps: humanRps + botRps - blocked,
    blocked_rps: blocked,
    active_sessions: Math.round((s.phase === "ADMITTING" ? 14_000 : 6_000) * scale * (0.9 + rnd() * 0.2)),
    latency_p50: 28 + load * 30 + rnd() * 6,
    latency_p95: 70 + load * 90 + rnd() * 20,
    latency_p99: 140 + load * 200 + rnd() * 60,
    error_rate: 0.001 + load * 0.004 * rnd(),
    turnstile_pass: totals.pass,
    turnstile_fail: totals.fail,
    rate_limited: totals.limited,
    flagged_sessions: totals.flagged,
    seats_confirmed: seatsConfirmed(s, now),
    seats_reserved: s.phase === "ADMITTING" ? Math.min(seats(s) - seatsConfirmed(s, now), BATCH + Math.round(rnd() * 20)) : 0,
    reservations_expired: Math.floor(el * (ADMIT_PER_SEC - CONFIRM_PER_SEC)),
    admission_batch: Math.floor((el * ADMIT_PER_SEC) / BATCH),
    duplicate_allocations: 0,
    oversold: 0,
    phase: s.phase,
  };
}

const PROFILES: BotProfile[] = ["naive_spammer", "fast_refresher", "multi_account", "headless_solver", "distributed"];

function attackEvents(s: MockState, now: number): AttackEvent[] {
  const out: AttackEvent[] = [];
  const intense = s.attack && now < s.attack.until;
  const profiles = intense ? s.attack!.profiles : PROFILES;
  const actions: AttackEvent["action"][] = ["rate_limited", "turnstile_failed", "duplicate_identity", "flagged", "blocked_ip", "allowed"];
  const details: Record<AttackEvent["action"], string> = {
    rate_limited: "token bucket empty, 429 with retry_after",
    turnstile_failed: "siteverify rejected token",
    duplicate_identity: "second registration for same Google account",
    flagged: "headless fingerprint + uniform request timing",
    blocked_ip: "ASN on datacenter blocklist",
    allowed: "passed Turnstile and identity checks",
  };
  const step = intense ? 400 : 4_000;
  for (let i = 0; i < 40; i++) {
    const t = now - i * step;
    const r = mulberry32(Math.floor(t / step) + s.eventId.length);
    const action = actions[Math.floor(r() * actions.length)];
    out.push({
      id: `atk_${Math.floor(t / step)}`,
      t: new Date(t).toISOString(),
      profile: profiles[Math.floor(r() * profiles.length)],
      session_id: `s_${Math.floor(r() * 1e8).toString(36)}`,
      action,
      detail: details[action],
    });
  }
  return out;
}

export const mockApi: Api = {
  async listEvents() {
    await delay(120);
    const now = Date.now();
    return CATALOG.map((c) => {
      const s = load(c.id);
      tick(s, now);
      return eventOf(s, now);
    });
  },

  async getEvent(eventId) {
    const t0 = Date.now();
    const ev = await call(eventId, (s) => eventOf(s));
    recordServerTime(ev.server_time, t0, Date.now());
    return ev;
  },

  getMe: (eventId) => call(eventId, (s) => meOf(s)),

  async myEntries() {
    await delay(120);
    const now = Date.now();
    return CATALOG.flatMap((c) => {
      const s = load(c.id);
      tick(s, now);
      return s.me ? [{ event: eventOf(s, now), me: meOf(s, now) }] : [];
    });
  },

  register: (eventId, { turnstile_token: token, idempotency_key: key, full_name }) =>
    call(
      eventId,
      (s) => {
        if (!token) throw new ApiError(400, "turnstile_required", "Complete the human check first.");
        if (s.idem[key] || s.me) return { created: false, me: meOf(s) };
        if (s.phase !== "REGISTRATION_OPEN") throw new ApiError(409, "registration_closed", "Registration is closed.");
        s.me = { entryId: id("ent"), registeredAt: Date.now(), name: full_name };
        s.idem[key] = s.me.entryId;
        log(s, "admin_action", "participant", `entry ${s.me.entryId} created`);
        return { created: true, me: meOf(s) };
      },
      { limited: true },
    ),

  confirm: (eventId, reservationId, key) =>
    call(
      eventId,
      (s) => {
        const me = meOf(s);
        if (me.status === "CONFIRMED") return me; // idempotent replay
        if (me.status !== "ADMITTED" || me.reservation_id !== reservationId)
          throw new ApiError(409, me.status === "EXPIRED" ? "reservation_expired" : "not_admitted", "This reservation is no longer active.");
        s.me!.confirmedAt = Date.now();
        s.me!.ticketId = `FD-${s.me!.entryId.slice(4, 8).toUpperCase()}-${Math.floor(1000 + Math.random() * 9000)}`;
        s.idem[key] = s.me!.ticketId;
        log(s, "confirmation", "participant", `seat confirmed, ticket ${s.me!.ticketId}`);
        return meOf(s);
      },
      { limited: true },
    ),

  admin: {
    metrics: (eventId) =>
      call(eventId, (s) => {
        const now = Date.now();
        const history = histories.get(eventId) ?? [];
        histories.set(eventId, history);
        const cur = snapshot(s, now);
        if (!history.length || now - Date.parse(history[history.length - 1].t) >= 900) history.push(cur);
        if (history.length > 120) history.shift();
        return { current: cur, history: [...history] };
      }),
    comparison: async (_eventId, p: SimParams) => {
      await delay(200);
      return compare(p);
    },
    attacks: (eventId) =>
      call(eventId, (s) => {
        const now = Date.now();
        const att = s.attack && now < s.attack.until ? s.attack : undefined;
        return {
          events: attackEvents(s, now),
          by_profile: PROFILES.map((profile, i) => {
            const active = att?.profiles.includes(profile);
            const requests = Math.round((active ? att!.bots * att!.bot_rps * 30 : 4_000) / (i + 1));
            return { profile, requests, blocked: Math.round(requests * (0.93 + i * 0.01)), seats_won: profile === "distributed" && active ? 2 : 0 };
          }),
        };
      }),
    allocations: (eventId) =>
      call(eventId, (s) => {
        const now = Date.now();
        const total = elapsed(s, now);
        const SEATS = seats(s);
        const pts = 30;
        const timeline = Array.from({ length: pts + 1 }, (_, i) => {
          const e = (total / pts) * i;
          const confirmed = Math.min(SEATS, Math.floor((e / 1000) * CONFIRM_PER_SEC));
          return {
            t: new Date(now - (total - e)).toISOString(),
            confirmed,
            reserved: e === 0 || confirmed >= SEATS ? 0 : Math.min(SEATS - confirmed, BATCH),
            expired: Math.floor((e / 1000) * (ADMIT_PER_SEC - CONFIRM_PER_SEC)),
          };
        });
        const nBatches = Math.ceil(((total / 1000) * ADMIT_PER_SEC) / BATCH);
        const start = now - total;
        return {
          seats_total: SEATS,
          timeline,
          batches: Array.from({ length: nBatches }, (_, b) => ({
            batch: b + 1,
            size: BATCH,
            admitted_at: new Date(start + ((b * BATCH) / ADMIT_PER_SEC) * 1000).toISOString(),
            confirmed: Math.round(BATCH * (CONFIRM_PER_SEC / ADMIT_PER_SEC)),
            expired: Math.round(BATCH * (1 - CONFIRM_PER_SEC / ADMIT_PER_SEC)),
          })).reverse(),
          integrity: { duplicate_allocations: 0, oversold: 0, checked_at: new Date(now).toISOString() },
        };
      }),
    audit: (eventId) => call(eventId, (s) => s.audit),
    action: (eventId, a) =>
      call(eventId, (s) => {
        const now = Date.now();
        const allowed: Record<typeof a, Phase[]> = {
          "open-registration": ["ENDED", "SOLD_OUT"],
          "close-registration": ["REGISTRATION_OPEN"],
          "generate-queue": ["REGISTRATION_CLOSED"],
          "start-admission": ["QUEUE_READY", "ADMITTING"],
          pause: ["ADMITTING"],
          reset: ["REGISTRATION_OPEN", "REGISTRATION_CLOSED", "QUEUE_READY", "ADMITTING", "SOLD_OUT", "ENDED"],
        };
        if (!allowed[a].includes(s.phase)) throw new ApiError(409, "invalid_transition", `Can't ${a.replace("-", " ")} while ${s.phase}.`);
        s.schedule = undefined;
        if (a === "reset") {
          const keep = s.audit;
          Object.assign(s, fresh(eventId, "REGISTRATION_OPEN"));
          s.openedAt = now;
          s.audit = keep;
          histories.delete(eventId);
          log(s, "admin_action", "admin", "event reset");
          return;
        }
        if (a === "close-registration") setPhase(s, "REGISTRATION_CLOSED", "admin", now);
        if (a === "generate-queue") setPhase(s, "QUEUE_READY", "admin", now);
        if (a === "open-registration") setPhase(s, "REGISTRATION_OPEN", "admin", now);
        if (a === "start-admission") {
          if (s.phase === "ADMITTING" && !s.runningSince) {
            s.runningSince = now;
            log(s, "admin_action", "admin", "admission resumed", now);
          } else setPhase(s, "ADMITTING", "admin", now);
        }
        if (a === "pause" && s.runningSince) {
          s.admitElapsed = elapsed(s, now);
          s.runningSince = undefined;
          s.pausedAt = now;
          log(s, "admin_action", "admin", "admission paused", now);
        }
      }),
    runSimulator: (eventId, p) =>
      call(eventId, (s) => {
        s.attack = { until: Date.now() + (p.duration_s ?? 60) * 1000, bots: p.bots, bot_rps: p.bot_rps, profiles: p.profiles };
        const run_id = id("run");
        log(s, "attack", "simulator", `run ${run_id}: ${p.bots} bots x ${p.bot_rps} rps (${p.profiles.join(", ")})`);
        return { run_id };
      }),
    stopSimulator: (eventId) =>
      call(eventId, (s) => {
        if (s.attack) log(s, "attack", "simulator", "run stopped");
        s.attack = undefined;
      }),
  },
};

// ---- dev controls (mock only) ----

export const SCENARIOS = [
  "registration_open",
  "registered",
  "closed",
  "queued",
  "admitted",
  "expiring",
  "expired",
  "confirmed",
  "sold_out",
  "ineligible",
  "rate_limited",
  "offline",
  "demo_timeline",
] as const;
export type Scenario = (typeof SCENARIOS)[number];

/** Jump one event's mock state to a named scenario. */
export function applyScenario(eventId: string, name: Scenario) {
  const now = Date.now();
  const s = load(eventId);
  const windowMs = seed(eventId).reservation_window_s * 1000;
  const entry = (): MyEntry => (s.me ??= { entryId: id("ent"), registeredAt: now - 3600_000, name: currentUserName() as string });
  const queueAt = (pos: number) => {
    s.closedAt = now - 120_000;
    const e = entry();
    e.position = pos;
    e.total = registrations(s, now);
    e.confirmedAt = undefined;
  };
  const reset = () => Object.assign(s, fresh(eventId, "REGISTRATION_OPEN"), { audit: s.audit, me: undefined });
  s.ineligible = undefined;
  s.schedule = undefined;
  switch (name) {
    case "registration_open":
      reset();
      break;
    case "registered":
      reset();
      entry();
      break;
    case "closed":
      s.phase = "REGISTRATION_CLOSED";
      s.closedAt = now;
      entry().position = undefined;
      break;
    case "queued":
      queueAt(142);
      s.phase = "ADMITTING";
      s.admitElapsed = 10_000;
      s.runningSince = now;
      break;
    case "admitted":
    case "expiring":
    case "expired": {
      queueAt(100);
      s.phase = "ADMITTING";
      const need = (99 / ADMIT_PER_SEC) * 1000;
      const ago = name === "admitted" ? 5_000 : name === "expiring" ? windowMs - 20_000 : windowMs + 5_000;
      s.admitElapsed = 0;
      s.runningSince = now - need - ago;
      break;
    }
    case "confirmed":
      queueAt(100);
      s.phase = "ADMITTING";
      s.admitElapsed = 60_000;
      s.runningSince = now;
      s.me!.confirmedAt = now - 30_000;
      s.me!.ticketId = "FD-DEMO-4821";
      s.me!.position = 317; // seat #318 in the demo
      break;
    case "sold_out":
      queueAt(seats(s) * 8);
      s.phase = "SOLD_OUT";
      s.admitElapsed = (seats(s) / CONFIRM_PER_SEC) * 1000;
      s.runningSince = undefined;
      s.pausedAt = now;
      break;
    case "ineligible":
      s.ineligible = "This event is limited to registered college students and GDG members.";
      break;
    case "rate_limited":
      s.rateLimitedUntil = now + 12_000;
      break;
    case "offline":
      s.offlineUntil = now + 15_000;
      break;
    case "demo_timeline":
      // registered now, then the whole journey plays out over ~20s + queue time
      reset();
      entry().registeredAt = now;
      s.schedule = [
        { phase: "REGISTRATION_CLOSED", at: now + 6_000 },
        { phase: "QUEUE_READY", at: now + 12_000 },
        { phase: "ADMITTING", at: now + 18_000 },
      ];
      break;
  }
  log(s, "admin_action", "demo panel", `scenario: ${name}`);
  save(s);
}
