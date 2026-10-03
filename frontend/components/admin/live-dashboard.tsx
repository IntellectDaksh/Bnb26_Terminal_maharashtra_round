"use client";

import Link from "next/link";
import { useState } from "react";
import { getAdminStatus, liveAdminAction } from "@/lib/api/live";
import { ApiError } from "@/lib/api";
import { Button, MetricCard, Skeleton } from "@/components/ui";
import { Notice, PageHeader, Panel, useEventPoll, usePoll } from "./shared";

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
      <PageHeader title="Live allocation" subtitle="Manage registration and seat offers for this drop. Every participant gets the same fair start." />
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
        <Panel title="Drop controls" subtitle="Open registration, close the entry window, then draw the queue.">
          <div className="flex flex-wrap gap-3">
            <Button disabled={pending || snapshot.event.status !== "DRAFT"} onClick={() => act("open")}>Open registration</Button>
            <Button variant="secondary" disabled={pending || snapshot.event.status !== "OPEN" || canDraw} onClick={() => act("close")}>Close registration</Button>
            <Button variant="primary" disabled={pending || !canDraw} onClick={() => act("draw")}>Draw queue and offer places</Button>
          </div>
          <Link href={`/events/${event.eventId}`} className="mt-5 inline-flex text-sm font-medium text-muted hover:text-fg">Open participant page →</Link>
        </Panel>
      </>}
    </section>
  );
}
