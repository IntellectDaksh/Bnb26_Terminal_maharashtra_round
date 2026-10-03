"use client";

import { QRCodeSVG } from "qrcode.react";
import type { EventInfo, Ticket } from "@/lib/contracts";

export function QRCard({ value, size = 132 }: { value: string; size?: number }) {
  return (
    <figure className="flex flex-col items-center">
      <div className="rounded-xl border border-line bg-white p-3.5">
        <QRCodeSVG value={value} size={size} level="M" bgColor="#ffffff" fgColor="#09090b" title={`Ticket ${value}`} />
      </div>
      <figcaption className="mt-3 text-[10px] font-semibold uppercase tracking-[0.2em] text-zinc-500">Show at entry</figcaption>
    </figure>
  );
}

/** QR payload: ticket id only. The door scanner looks it up server-side; nothing is trusted from the code itself. */
export const qrValue = (t: Ticket) => `FAIRDROP:${t.ticket_id}`;

export function icsHref(t: Ticket, ev: EventInfo) {
  const f = (d: Date) => d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
  const ics = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Fair Drop//EN",
    "BEGIN:VEVENT",
    `UID:${t.ticket_id}@fairdrop`,
    `DTSTAMP:${f(new Date())}`,
    `DTSTART:${f(new Date(ev.starts_at))}`,
    `DTEND:${f(new Date(ev.ends_at))}`,
    `SUMMARY:${ev.name}`,
    `LOCATION:${ev.venue}, ${ev.city}`,
    `DESCRIPTION:Ticket ${t.ticket_id}, seat ${t.seat_label}`,
    "END:VEVENT",
    "END:VCALENDAR",
  ].join("\r\n");
  return `data:text/calendar;charset=utf-8,${encodeURIComponent(ics)}`;
}

/** Perforation with punched notches (notch colour matches the background page behind the ticket). */
export function Perforation({ vertical }: { vertical?: boolean }) {
  return vertical ? (
    <div className="relative w-8 shrink-0 flex items-center justify-center select-none" aria-hidden>
      <span className="absolute -top-4 left-1/2 -translate-x-1/2 size-8 rounded-full bg-bg border border-line" />
      <span className="h-full border-l-2 border-dashed border-line" />
      <span className="absolute -bottom-4 left-1/2 -translate-x-1/2 size-8 rounded-full bg-bg border border-line" />
    </div>
  ) : (
    <div className="relative h-8 w-full flex items-center justify-center select-none" aria-hidden>
      <span className="absolute -left-4 top-1/2 -translate-y-1/2 size-8 rounded-full bg-bg border border-line" />
      <span className="w-full border-t-2 border-dashed border-line" />
      <span className="absolute -right-4 top-1/2 -translate-y-1/2 size-8 rounded-full bg-bg border border-line" />
    </div>
  );
}
