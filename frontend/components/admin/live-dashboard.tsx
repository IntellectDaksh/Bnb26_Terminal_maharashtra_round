"use client";

import Link from "next/link";
import { useState } from "react";
import { getAdminStatus, liveAdminAction } from "@/lib/api/live";
import { ApiError } from "@/lib/api";
import { Button, MetricCard, Skeleton } from "@/components/ui";
import { Notice, useEventPoll, usePoll } from "./shared";

export function LiveDashboard() {
  const event = useEventPoll();
  const status = usePoll(() => getAdminStatus(event.eventId), 5000, [event.eventId]);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);
  const snapshot = status.data;
  async function act(action: "open" | "close" | "draw") {
    setPending(true);
    setError(null);
    try {
      await liveAdminAction(event.eventId, action);
      status.refresh();
      event.refresh();
    } catch (e) {
      setError(e instanceof ApiError ? e : new ApiError(0, "network", "Can't reach the backend."));
    } finally { setPending(false); }
  }
  const canDraw = snapshot?.event.status === "OPEN" &&
    Date.parse(snapshot.server_time) >= Date.parse(snapshot.event.registration_closes_at);
  return (
    <section className="space-y-6">
      <header>
        <h1 className="text-3xl font-semibold">Live allocation</h1>
        <p className="mt-2 text-sm text-zinc-600">Open registration, close the entry window, then draw the queue. Offered places expire after three minutes.</p>
      </header>
      <Notice error={error ?? status.error} />
      {!snapshot ? <Skeleton className="h-40" /> : <>
        <p className="text-sm">Status: <strong>{snapshot.event.status}</strong> · Registration closes: {new Date(snapshot.event.registration_closes_at).toLocaleString()}</p>
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <MetricCard label="Registrations" value={snapshot.registrations} />
          <MetricCard label="Waiting" value={snapshot.queued} />
          <MetricCard label="Active offers" value={snapshot.active_reservations} />
          <MetricCard label="Confirmed" value={snapshot.confirmed} />
          <MetricCard label="Capacity" value={snapshot.event.capacity} />
          <MetricCard label="Available" value={snapshot.available_capacity} />
          <MetricCard label="Expired" value={snapshot.expired} />
        </div>
        <div className="flex flex-wrap gap-3">
          <Button disabled={pending || snapshot.event.status !== "DRAFT"} onClick={() => act("open")}>Open registration</Button>
          <Button disabled={pending || snapshot.event.status !== "OPEN" || canDraw} onClick={() => act("close")}>Close registration</Button>
          <Button variant="primary" disabled={pending || !canDraw} onClick={() => act("draw")}>Draw queue and offer places</Button>
        </div>
        <Link href={`/events/${event.eventId}`} className="text-sm underline">Open participant page</Link>
      </>}
    </section>
  );
}
