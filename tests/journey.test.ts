import { describe, expect, it } from "vitest";
import type { Me } from "@/lib/contracts";
import { etaText, isFinal, reconcile, routeFor } from "@/lib/state/journey";
import { backoff } from "@/lib/api";

const queued: Me = { status: "QUEUED", entry_id: "e", position: 10, total: 100 };
const admitted: Me = { status: "ADMITTED", entry_id: "e", reservation_id: "r", expires_at: new Date().toISOString() };

describe("journey", () => {
  it("routes every status", () => {
    expect(routeFor({ status: "NOT_REGISTERED" })).toBe("register");
    expect(routeFor(queued)).toBe("queue");
    expect(routeFor(admitted)).toBe("reservation");
    expect(routeFor({ status: "SOLD_OUT" })).toBe("status");
  });
  it("stale responses never move the user backwards", () => {
    expect(reconcile(admitted, queued, false)).toBe(admitted);
    expect(reconcile(queued, admitted, false)).toBe(admitted);
  });
  it("fresh responses always win (server is authority)", () => {
    expect(reconcile(admitted, queued, true)).toBe(queued);
  });
  it("final states", () => {
    expect(isFinal({ status: "EXPIRED", entry_id: "e" })).toBe(true);
    expect(isFinal(queued)).toBe(false);
  });
  it("eta is honest", () => {
    expect(etaText(5, 4, 1)).toBe("You're next");
    expect(etaText(500, 0, null)).toBeNull();
    expect(etaText(500, 0, 3)).toMatch(/min/);
  });
  it("backoff is capped and jittered", () => {
    for (let i = 0; i < 20; i++) expect(backoff(i, 1000, 30_000)).toBeLessThanOrEqual(30_000);
  });
});
