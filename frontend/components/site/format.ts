import type { EventInfo, Phase } from "@/lib/contracts";
import type { Tone } from "@/components/ui";

export const PHASE_COPY: Record<Phase, { label: string; short: string; tone: Tone; line: string }> = {
  DRAFT: { label: "Registration not open", short: "Not open", tone: "neutral", line: "The organizer has not opened registration yet." },
  REGISTRATION_OPEN: { label: "Registration open", short: "Open", tone: "success", line: "Join any time before it closes. Early doesn't beat late." },
  REGISTRATION_CLOSED: { label: "Registration closed", short: "Closed", tone: "neutral", line: "The entry list is frozen. Waiting for the organizer to draw positions." },
  QUEUE_READY: { label: "Queue drawn", short: "Starting soon", tone: "neutral", line: "Every entry has a random position. Admission starts soon." },
  ADMITTING: { label: "Live drop", short: "Live", tone: "live", line: "People are being admitted in small batches, in queue order." },
  SOLD_OUT: { label: "Sold out", short: "Sold out", tone: "danger", line: "Every seat has been confirmed." },
  ENDED: { label: "Ended", short: "Ended", tone: "neutral", line: "This drop is over." },
};

const tz = "Asia/Kolkata";
export const fmtDate = (iso: string) => new Date(iso).toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short", timeZone: tz });
export const fmtDateLong = (iso: string) => new Date(iso).toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: tz });
export const fmtTime = (iso: string) => new Date(iso).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: tz });
export const fmtPrice = (inr: number) => (inr === 0 ? "Free" : `₹${inr.toLocaleString("en-IN")}`);
export const fmtNum = (n: number) => n.toLocaleString("en-IN");

export const seatsLeft = (e: EventInfo) => Math.max(0, e.seats_total - e.seats_confirmed);

/** Order for listings: live first, then open, starting soon, drawing, sold out. */
export const PHASE_ORDER: Record<Phase, number> = {
  DRAFT: 3,
  ADMITTING: 0,
  REGISTRATION_OPEN: 1,
  QUEUE_READY: 2,
  REGISTRATION_CLOSED: 3,
  SOLD_OUT: 4,
  ENDED: 5,
};
