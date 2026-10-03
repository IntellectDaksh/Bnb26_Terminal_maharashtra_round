import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { eventForUi, statusForUi, PublicEvent, QueueStatus } from "@/lib/api/backend-contracts";
import type { liveApi as LiveApi } from "@/lib/api/live";

vi.mock("@/lib/supabase/client", () => ({
  accessToken: async () => "verified-by-backend",
  supabaseBrowser: () => null,
}));

const eventId = "c4a56c7a-a7eb-46f7-a2e5-7cc0b1f5872a";
const entryId = "89b3b9c7-6d0d-4c6b-ae7c-291e7a2b3c59";
const reservationId = "029b1020-6fc6-4c34-90d7-3f477d53f01b";
const now = "2026-10-03T20:00:00Z";
const event = PublicEvent.parse({
  id: eventId, name: "Test allocation", capacity: 2, status: "OPEN",
  registration_opens_at: "2026-10-03T19:00:00Z", registration_closes_at: "2026-10-03T21:00:00Z",
  next_queue_position: 1, draw_completed_at: null, created_at: "2026-10-03T18:00:00Z",
  registrations: 5, confirmed: 0, active_reservations: 0, server_time: now,
});
const registration = {
  id: entryId, event_id: eventId, status: "ELIGIBLE" as const,
  queue_position: null, registered_at: now,
};
const queue = QueueStatus.parse({
  event_id: eventId, event_status: "OPEN", registration, reservation: null,
  ticket_confirmed: false, server_time: now,
});
const hold = {
  id: reservationId, status: "OFFERED" as const, offered_at: now,
  expires_at: "2026-10-03T20:03:00Z", confirmed_at: null,
};

describe("PRD allocation adapter", () => {
  it("uses database time to close registration and distinguish a draft", () => {
    expect(eventForUi(event).phase).toBe("REGISTRATION_OPEN");
    expect(eventForUi({ ...event, status: "DRAFT" }).phase).toBe("DRAFT");
    expect(eventForUi({ ...event, server_time: event.registration_closes_at }).phase).toBe("REGISTRATION_CLOSED");
    expect(eventForUi(event).reservation_window_s).toBe(180);
  });
  it("restores registration and the immutable rank without estimating admission rate", () => {
    expect(statusForUi({ ...queue, registration: null }, 5)).toEqual({ status: "NOT_REGISTERED" });
    expect(statusForUi(queue, 5).status).toBe("REGISTERED");
    expect(statusForUi({ ...queue, registration: { ...registration, status: "QUEUED", queue_position: 4 } }, 5))
      .toEqual({ status: "QUEUED", entry_id: entryId, position: 4, total: 5 });
  });
  it("shows a live offer and expires it at the exact server deadline", () => {
    const q = { ...queue, reservation: hold };
    expect(statusForUi(q, 5)).toEqual({ status: "ADMITTED", entry_id: entryId, reservation_id: reservationId, expires_at: hold.expires_at });
    expect(statusForUi({ ...q, server_time: hold.expires_at }, 5)).toEqual({ status: "EXPIRED", entry_id: entryId });
  });
  it("keeps a confirmed ticket after the event ends, with its persisted reservation UUID", () => {
    const q = QueueStatus.parse({
      ...queue, event_status: "FINISHED", ticket_confirmed: true,
      registration: { ...registration, status: "CONFIRMED", queue_position: 1 },
      reservation: { ...hold, status: "CONFIRMED", confirmed_at: now },
    });
    expect(statusForUi(q, 5, "Anshul")).toEqual({
      status: "CONFIRMED", entry_id: entryId,
      ticket: { ticket_id: reservationId, seat_label: "General admission", holder_name: "Anshul", confirmed_at: now },
    });
    expect(statusForUi({ ...queue, event_status: "FINISHED", registration: { ...registration, status: "QUEUED", queue_position: 4 } }, 5).status).toBe("SOLD_OUT");
  });
});

describe("live HTTP contract", () => {
  let api: typeof LiveApi;
  beforeAll(async () => {
    vi.stubEnv("NEXT_PUBLIC_API_BASE_URL", "http://127.0.0.1:8000/api/v1");
    api = (await import("@/lib/api/live")).liveApi;
  });
  afterEach(() => vi.unstubAllGlobals());

  it("sends only a security token for registration and reconciles from the backend", async () => {
    const fetcher = vi.fn(async (url: string, init: RequestInit) => {
      expect(new Headers(init.headers).get("Authorization")).toBe("Bearer verified-by-backend");
      if (url.endsWith("/register")) {
        expect(init.method).toBe("POST");
        expect(JSON.parse(init.body as string)).toEqual({ security_token: "captcha-result" });
        return Response.json({ created: true, registration });
      }
      return Response.json(url.endsWith("/me") ? queue : event);
    });
    vi.stubGlobal("fetch", fetcher);
    expect(await api.register(eventId, {
      turnstile_token: "captcha-result", idempotency_key: "retry-key-123",
      full_name: "Participant", organization: "Test", eligibility_confirmed: true,
    })).toEqual({ created: true, me: { status: "REGISTERED", entry_id: entryId, registered_at: now } });
    expect(fetcher.mock.calls.every(([url]) => url.startsWith("http://127.0.0.1:8000/api/v1/events/"))).toBe(true);
  });
  it("confirms through the owned event endpoint, without trusting a client reservation id", async () => {
    const confirmed = { ...hold, status: "CONFIRMED", confirmed_at: now };
    vi.stubGlobal("fetch", vi.fn(async (url: string, init: RequestInit) => {
      if (init.method === "POST") {
        expect(url).toBe(`http://127.0.0.1:8000/api/v1/events/${eventId}/confirm`);
        expect(JSON.parse(init.body as string)).toEqual({});
        return Response.json({ event_id: eventId, queue_position: 1, ticket_confirmed: true, reservation: confirmed });
      }
      return Response.json(url.endsWith("/me") ? { ...queue, ticket_confirmed: true, reservation: confirmed } : event);
    }));
    const me = await api.confirm(eventId, "untrusted-client-id", "retry-key-123");
    expect(me.status).toBe("CONFIRMED");
    if (me.status === "CONFIRMED") expect(me.ticket.ticket_id).toBe(reservationId);
  });
  it("propagates rejection and refuses malformed successful responses", async () => {
    vi.stubGlobal("fetch", async () => Response.json({ code: "reservation_expired", message: "Offer expired." }, { status: 409 }));
    await expect(api.confirm(eventId, reservationId, "retry-key-123")).rejects.toMatchObject({ status: 409, code: "reservation_expired" });
    vi.stubGlobal("fetch", async () => Response.json({ id: "legacy-slug" }));
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    await expect(api.getEvent(eventId)).rejects.toMatchObject({ code: "contract_mismatch" });
    log.mockRestore();
  });
});
