import { z } from "zod";
import type { EventInfo, Me } from "@/lib/contracts";

const time = z.iso.datetime({ offset: true });
const id = z.uuid();
export const BackendEvent = z.object({
  id, name: z.string(), capacity: z.number().int().positive(),
  status: z.enum(["DRAFT", "OPEN", "DRAWING", "LIVE", "FINISHED", "CANCELLED"]),
  registration_opens_at: time, registration_closes_at: time,
  next_queue_position: z.number().int(), draw_completed_at: time.nullable(), created_at: time,
});
export const PublicEvent = BackendEvent.extend({
  registrations: z.number().int().nonnegative(), confirmed: z.number().int().nonnegative(),
  active_reservations: z.number().int().nonnegative(), server_time: time,
});
export const BackendRegistration = z.object({
  id, event_id: id, status: z.enum(["ELIGIBLE", "QUEUED", "OFFERED", "CONFIRMED", "EXPIRED"]),
  queue_position: z.number().int().positive().nullable(), registered_at: time,
});
export const BackendReservation = z.object({
  id, status: z.enum(["OFFERED", "CONFIRMED", "EXPIRED"]),
  offered_at: time, expires_at: time, confirmed_at: time.nullable(),
});
export const QueueStatus = z.object({
  event_id: id, event_status: BackendEvent.shape.status,
  registration: BackendRegistration.nullable(), reservation: BackendReservation.nullable(),
  ticket_confirmed: z.boolean(), server_time: time,
});
export const BackendRegisterResult = z.object({ created: z.boolean(), registration: BackendRegistration });
export const BackendConfirmation = z.object({
  event_id: id, queue_position: z.number().int().positive(),
  ticket_confirmed: z.literal(true), reservation: BackendReservation,
});
export const AdminSnapshot = z.object({
  event: BackendEvent, registrations: z.number().int(), queued: z.number().int(),
  confirmed: z.number().int(), active_reservations: z.number().int(),
  expired: z.number().int(), available_capacity: z.number().int(), server_time: time,
});

export function eventForUi(e: z.infer<typeof PublicEvent>): EventInfo {
  const now = Date.parse(e.server_time);
  const phase: EventInfo["phase"] =
    e.status === "OPEN" && now >= Date.parse(e.registration_opens_at) && now < Date.parse(e.registration_closes_at)
      ? "REGISTRATION_OPEN"
      : e.status === "DRAFT" || (e.status === "OPEN" && now < Date.parse(e.registration_opens_at)) ? "DRAFT"
      : e.status === "LIVE" ? "ADMITTING"
      : e.status === "FINISHED" ? (e.confirmed === e.capacity ? "SOLD_OUT" : "ENDED")
      : e.status === "CANCELLED" ? "ENDED" : "REGISTRATION_CLOSED";
  return {
    id: e.id, name: e.name, phase,
    tagline: "Fair allocation · three-minute confirmation window",
    description: "Backend allocation test. The displayed schedule is the registration deadline. Register, wait for the draw, and confirm an offered place within three minutes.",
    category: "conference", organizer: "Fair Drop", city: "Online test", venue: "Online test",
    starts_at: e.registration_closes_at, ends_at: e.registration_closes_at, price_inr: 0,
    reservation_window_s: 180, registration_closes_at: e.registration_closes_at,
    seats_total: e.capacity, seats_confirmed: e.confirmed,
    seats_reserved: e.active_reservations, registrations: e.registrations, server_time: e.server_time,
  };
}

export function statusForUi(q: z.infer<typeof QueueStatus>, total: number, holderName = "Participant"): Me {
  const r = q.registration;
  const hold = q.reservation;
  if (!r) return { status: "NOT_REGISTERED" };
  if (q.ticket_confirmed && hold?.status === "CONFIRMED" && hold.confirmed_at)
    return { status: "CONFIRMED", entry_id: r.id, ticket: {
      ticket_id: hold.id, seat_label: "General admission", holder_name: holderName, confirmed_at: hold.confirmed_at,
    } };
  if (r.status === "EXPIRED" || hold?.status === "EXPIRED")
    return { status: "EXPIRED", entry_id: r.id };
  if (hold?.status === "OFFERED") {
    if (Date.parse(hold.expires_at) <= Date.parse(q.server_time)) return { status: "EXPIRED", entry_id: r.id };
    return { status: "ADMITTED", entry_id: r.id, reservation_id: hold.id, expires_at: hold.expires_at };
  }
  if (q.event_status === "FINISHED" || q.event_status === "CANCELLED") return { status: "SOLD_OUT", entry_id: r.id };
  if (r.status === "QUEUED" && r.queue_position !== null)
    return { status: "QUEUED", entry_id: r.id, position: r.queue_position, total };
  return { status: "REGISTERED", entry_id: r.id, registered_at: r.registered_at };
}
