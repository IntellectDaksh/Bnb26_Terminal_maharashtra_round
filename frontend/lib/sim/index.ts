import type { BotProfile, Comparison, ComparisonRow, SimParams, StrategyResult } from "@/lib/contracts";

// Deterministic model of one flash sale run under two allocation strategies.
// Used by the mock backend and as a reference for the simulator team.
// ponytail: statistical model, not a load test. Real numbers come from POST /admin/simulator/run.

export function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Jain's fairness index: 1 = perfectly equal, 1/n = one party gets everything. */
export function jain(xs: number[]): number {
  const sum = xs.reduce((a, b) => a + b, 0);
  const sq = xs.reduce((a, b) => a + b * b, 0);
  // nobody won anything: report 0, not "perfectly equal", so a 100%-bot outcome can't read as fair
  return sq === 0 ? 0 : (sum * sum) / (xs.length * sq);
}

// Chance a bot of this profile is stopped before entering the pool
// (Turnstile, identity dedupe, eligibility). Request volume does not change it.
export const DETECTION: Record<BotProfile, number> = {
  naive_spammer: 0.99,
  fast_refresher: 0.96,
  multi_account: 0.72,
  headless_solver: 0.6,
  distributed: 0.55,
};

type Cohort = "human_slow" | "human_avg" | "human_fast" | "bot";
type Actor = { cohort: Cohort; arrival: number; profile?: BotProfile };
const COHORTS: Cohort[] = ["human_fast", "human_avg", "human_slow", "bot"];
const HUMAN_CONFIRM = 0.92;
const BOT_CONFIRM = 0.99;
const BUCKETS = [5_000, 30_000, 120_000, 600_000, Infinity];
const BUCKET_LABELS = ["<5s", "5-30s", "30s-2m", "2-10m", ">10m"];

function actors(p: SimParams, rnd: () => number): Actor[] {
  const out: Actor[] = [];
  for (let i = 0; i < p.humans; i++) {
    const r = rnd();
    // reaction + network time after the sale opens, ms
    if (r < 0.2) out.push({ cohort: "human_fast", arrival: 800 + rnd() * 2_200 });
    else if (r < 0.7) out.push({ cohort: "human_avg", arrival: 3_000 + rnd() * 6_000 });
    else out.push({ cohort: "human_slow", arrival: 9_000 + rnd() * 30_000 });
  }
  for (let i = 0; i < p.bots; i++) {
    const profile = p.profiles[i % p.profiles.length];
    // more requests/sec = earlier first successful hit under FIFO
    out.push({ cohort: "bot", profile, arrival: (40 + rnd() * 400) / Math.max(1, Math.sqrt(p.bot_rps)) });
  }
  return out;
}

function summarize(strategy: "fifo" | "protected", all: Actor[], winners: { a: Actor; t: number }[]): StrategyResult {
  const totals = new Map<Cohort, number>();
  const wins = new Map<Cohort, number>();
  for (const a of all) totals.set(a.cohort, (totals.get(a.cohort) ?? 0) + 1);
  for (const w of winners) wins.set(w.a.cohort, (wins.get(w.a.cohort) ?? 0) + 1);
  const cohorts = COHORTS.filter((c) => totals.get(c)).map((c) => ({
    cohort: c,
    participants: totals.get(c) ?? 0,
    seats: wins.get(c) ?? 0,
    win_rate: (wins.get(c) ?? 0) / (totals.get(c) ?? 1),
  }));
  const seats = winners.length || 1;
  const botSeats = wins.get("bot") ?? 0;
  const times = winners.map((w) => w.t).sort((x, y) => x - y);
  const q = (p: number) => times[Math.min(times.length - 1, Math.floor(p * times.length))] ?? 0;
  const histogram = BUCKET_LABELS.map((bucket) => ({ bucket, humans: 0, bots: 0 }));
  for (const w of winners) {
    const h = histogram[BUCKETS.findIndex((b) => w.t < b)];
    if (w.a.cohort === "bot") h.bots++;
    else h.humans++;
  }
  return {
    strategy,
    bot_seat_share: botSeats / seats,
    human_seat_share: 1 - botSeats / seats,
    // fairness among real people: does reaction/network speed change your odds?
    jain_index: jain(cohorts.filter((c) => c.cohort !== "bot").map((c) => c.win_rate)),
    cohorts,
    time_to_allocation_ms: { p50: q(0.5), p95: q(0.95), histogram },
  };
}

export function runFifo(p: SimParams): StrategyResult {
  const rnd = mulberry32(p.seed ?? 42);
  const all = actors(p, rnd);
  const sorted = [...all].sort((a, b) => a.arrival - b.arrival);
  const winners: { a: Actor; t: number }[] = [];
  for (const a of sorted) {
    if (winners.length >= p.seats) break;
    if (rnd() < (a.cohort === "bot" ? BOT_CONFIRM : HUMAN_CONFIRM)) winners.push({ a, t: a.arrival + 4_000 });
  }
  return summarize("fifo", all, winners);
}

export function runProtected(p: SimParams, batchSize = 50, windowMs = 120_000): StrategyResult {
  const rnd = mulberry32(p.seed ?? 42);
  const all = actors(p, rnd);
  // pool: one entry per identity; bots filtered by profile, humans have a small false-positive rate
  const pool = all.filter((a) => (a.cohort === "bot" ? rnd() >= DETECTION[a.profile!] : rnd() >= 0.003));
  // secure-random order (Fisher-Yates), arrival time ignored
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  const winners: { a: Actor; t: number }[] = [];
  let admitted = 0;
  for (const a of pool) {
    if (winners.length >= p.seats) break;
    const batch = Math.floor(admitted / batchSize);
    admitted++;
    const confirms = rnd() < (a.cohort === "bot" ? BOT_CONFIRM : HUMAN_CONFIRM);
    if (confirms) winners.push({ a, t: batch * (windowMs / 4) + 5_000 + rnd() * (windowMs * 0.6) });
  }
  return summarize("protected", all, winners);
}

export const PRESETS: { condition: string; bots: number; bot_rps: number; profiles: BotProfile[] }[] = [
  { condition: "No attack", bots: 0, bot_rps: 0, profiles: ["naive_spammer"] },
  { condition: "Naive spam", bots: 2_000, bot_rps: 50, profiles: ["naive_spammer"] },
  { condition: "Refresh storm", bots: 5_000, bot_rps: 20, profiles: ["fast_refresher"] },
  { condition: "Multi-account farm", bots: 3_000, bot_rps: 5, profiles: ["multi_account"] },
  { condition: "Solver + residential IPs", bots: 2_000, bot_rps: 10, profiles: ["headless_solver", "distributed"] },
  {
    condition: "Everything at once",
    bots: 10_000,
    bot_rps: 100,
    profiles: ["naive_spammer", "fast_refresher", "multi_account", "headless_solver", "distributed"],
  },
];

export function compare(p: SimParams): Comparison {
  const conditions: ComparisonRow[] = PRESETS.map((c) => {
    const q = { ...p, bots: c.bots, bot_rps: c.bot_rps, profiles: c.profiles };
    const f = runFifo(q);
    const s = runProtected(q);
    return {
      condition: c.condition,
      bots: c.bots,
      bot_rps: c.bot_rps,
      fifo_bot_share: f.bot_seat_share,
      protected_bot_share: s.bot_seat_share,
      fifo_jain: f.jain_index,
      protected_jain: s.jain_index,
    };
  });
  return { params: p, fifo: runFifo(p), protected: runProtected(p), conditions };
}
