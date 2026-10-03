"use client";

import { useCallback, useMemo, useState } from "react";
import { api } from "@/lib/api";
import type { AdminAction, AuditEntry, Phase } from "@/lib/contracts";
import { Button, Dialog, Input, Select, Skeleton, Toast } from "@/components/ui";
import { AUDIT_LABEL, Empty, Notice, PageHeader, Panel, TableWrap, errorText, hhmmss, phaseName, td, th, toApiError, usePoll, useEventPoll } from "@/components/admin/shared";

const ACTIONS: { action: AdminAction; label: string; help: string; when: Phase[]; confirm?: string; danger?: boolean }[] = [
  { action: "open-registration", label: "Open registration", help: "Start a fresh registration window.", when: ["ENDED", "SOLD_OUT"] },
  {
    action: "close-registration",
    label: "Close registration",
    help: "Stop accepting new registrations.",
    when: ["REGISTRATION_OPEN"],
    confirm: "New participants won't be able to register after this.",
  },
  { action: "generate-queue", label: "Generate queue", help: "Shuffle eligible registrations into a fair order.", when: ["REGISTRATION_CLOSED"] },
  { action: "start-admission", label: "Start admission", help: "Admit batches from the queue. Resumes after a pause.", when: ["QUEUE_READY", "ADMITTING"] },
  { action: "pause", label: "Pause admission", help: "Hold the next batch. Open reservations keep their timers.", when: ["ADMITTING"] },
  {
    action: "reset",
    label: "Reset event",
    help: "Clear registrations, queue and reservations. The audit log is kept.",
    when: ["REGISTRATION_OPEN", "REGISTRATION_CLOSED", "QUEUE_READY", "ADMITTING", "SOLD_OUT", "ENDED"],
    confirm: "This clears every registration, queue position and reservation. It can't be undone.",
    danger: true,
  },
];

export default function SettingsPage() {
  const event = useEventPoll();
  const audit = usePoll(() => api.admin.audit(event.eventId), 4000);
  const [pending, setPending] = useState<AdminAction | null>(null);
  const [confirming, setConfirming] = useState<(typeof ACTIONS)[number] | null>(null);
  const [toast, setToast] = useState<{ msg: string; tone: "success" | "danger" } | null>(null);
  const [kind, setKind] = useState<AuditEntry["kind"] | "all">("all");
  const [q, setQ] = useState("");
  const closeToast = useCallback(() => setToast(null), []);
  const cancel = useCallback(() => setConfirming(null), []);
  const phase = event.data?.phase;

  const run = async (a: AdminAction, label: string) => {
    setConfirming(null);
    setPending(a);
    try {
      await api.admin.action(event.eventId, a);
      setToast({ msg: `${label}: done.`, tone: "success" });
      event.refresh();
      audit.refresh();
    } catch (e) {
      const err = toApiError(e);
      setToast({ msg: err.status === 409 ? err.message || "That action isn't allowed in the current phase." : errorText(err), tone: "danger" });
    } finally {
      setPending(null);
    }
  };

  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return [...(audit.data ?? [])]
      .filter((r) => (kind === "all" || r.kind === kind) && (!needle || `${r.message} ${r.actor} ${AUDIT_LABEL[r.kind]}`.toLowerCase().includes(needle)))
      .sort((a, b) => b.t.localeCompare(a.t));
  }, [audit.data, kind, q]);

  return (
    <div className="rise">
      <PageHeader title={<>Event <em>settings</em></>} subtitle="Event phase controls and the full audit trail." />

      <Panel title="Event phase" subtitle={phase ? `Current phase: ${phaseName(phase)}` : undefined} className="mb-6">
        {event.error && (
          <div className="mb-4">
            <Notice error={event.error} retryIn={event.retryIn} />
          </div>
        )}
        {!phase ? (
          <Skeleton className="h-60" />
        ) : (
          <ul className="-my-4">
            {ACTIONS.map((a) => {
              const enabled = a.when.includes(phase);
              return (
                <li key={a.action} className="flex flex-wrap items-center justify-between gap-4 border-b border-line py-4 last:border-b-0">
                  <div className="min-w-0">
                    <div className="text-sm font-medium">{a.label}</div>
                    <div className="mt-0.5 text-[13px] text-muted">{a.help}</div>
                  </div>
                  <Button
                    size="sm"
                    variant={a.danger ? "danger" : "secondary"}
                    disabled={!enabled || (pending !== null && pending !== a.action)}
                    loading={pending === a.action}
                    onClick={() => (a.confirm ? setConfirming(a) : run(a.action, a.label))}
                  >
                    {a.label}
                  </Button>
                </li>
              );
            })}
          </ul>
        )}
      </Panel>

      <Panel title="Audit log">
        <div className="mb-6 grid gap-4 sm:grid-cols-[220px_1fr]">
          <Select label="Kind" name="kind" value={kind} onChange={(e) => setKind(e.target.value as typeof kind)}>
            <option value="all">All kinds</option>
            {(Object.keys(AUDIT_LABEL) as AuditEntry["kind"][]).map((k) => (
              <option key={k} value={k}>
                {AUDIT_LABEL[k]}
              </option>
            ))}
          </Select>
          <Input label="Search" name="q" type="search" placeholder="Message or actor" value={q} onChange={(e) => setQ(e.target.value)} autoComplete="off" />
        </div>
        {audit.error && (
          <div className="mb-4">
            <Notice error={audit.error} retryIn={audit.retryIn} />
          </div>
        )}
        {!audit.data ? (
          <Skeleton className="h-60" />
        ) : rows.length === 0 ? (
          <Empty>{audit.data.length ? "No entries match these filters." : "The audit log is empty."}</Empty>
        ) : (
          <TableWrap>
            <table className="w-full min-w-[600px]">
              <thead>
                <tr>
                  <th className={th}>Time</th>
                  <th className={th}>Event</th>
                  <th className={th}>Actor</th>
                  <th className={th}>Detail</th>
                </tr>
              </thead>
              <tbody>
                {rows.slice(0, 200).map((r) => (
                  <tr key={r.id}>
                    <td className={`${td} num whitespace-nowrap text-muted`}>{hhmmss(r.t)}</td>
                    <td className={`${td} whitespace-nowrap font-medium`}>{AUDIT_LABEL[r.kind]}</td>
                    <td className={`${td} text-muted`}>{r.actor}</td>
                    <td className={td}>{r.message}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableWrap>
        )}
      </Panel>

      <Dialog
        open={!!confirming}
        title={confirming ? `${confirming.label}?` : ""}
        body={confirming?.confirm}
        confirmLabel={confirming?.label ?? "Confirm"}
        danger={confirming?.danger}
        onConfirm={() => confirming && run(confirming.action, confirming.label)}
        onCancel={cancel}
      />
      <Toast message={toast?.msg ?? null} tone={toast?.tone} onClose={closeToast} />
    </div>
  );
}
