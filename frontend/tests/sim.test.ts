import { describe, expect, it } from "vitest";
import { compare, jain, runFifo, runProtected } from "@/lib/sim";

const base = { humans: 45_000, bots: 5_000, bot_rps: 20, seats: 500, profiles: ["fast_refresher" as const], seed: 7 };

describe("sim", () => {
  it("jain index bounds", () => {
    expect(jain([1, 1, 1])).toBeCloseTo(1);
    expect(jain([1, 0, 0, 0])).toBeCloseTo(0.25);
  });
  it("never allocates more than the seat count", () => {
    for (const r of [runFifo(base), runProtected(base)]) {
      expect(r.cohorts.reduce((a, c) => a + c.seats, 0)).toBeLessThanOrEqual(500);
    }
  });
  it("FIFO lets bots win, protected does not", () => {
    expect(runFifo(base).bot_seat_share).toBeGreaterThan(0.9);
    expect(runProtected(base).bot_seat_share).toBeLessThan(0.02);
  });
  it("speed does not matter for humans under protection", () => {
    expect(runProtected({ ...base, bots: 0 }).jain_index).toBeGreaterThan(0.95);
    expect(runFifo({ ...base, bots: 0 }).jain_index).toBeLessThan(0.6);
  });
  it("is deterministic per seed", () => {
    expect(compare(base)).toEqual(compare(base));
  });
});
