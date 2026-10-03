"use client";

import { useCallback, useMemo, useState } from "react";
import { api } from "@/lib/api";
import type { AdminAction, AuditEntry, Phase, SimParams } from "@/lib/contracts";
import { Button, Dialog, Input, Select, Skeleton, Toast, cx } from "@/components/ui";
import {
  AUDIT_LABEL,
  Empty,
  Notice,
  PageHeader,
  Panel,
  PhaseBadge,
  TableWrap,
  errorText,
  hhmmss,
  phaseName,
  td,
  th,
  toApiError,
  usePoll,
  useEventPoll,
} from "@/components/admin/shared";

const ACTIONS: {
  action: AdminAction;
  label: string;
  help: string;
  when: Phase[];
  confirm: string;
  danger?: boolean;
  variant?: "primary" | "secondary" | "danger";
}[] = [
  {
    action: "open-registration",
    label: "Open Registration",
    help: "Start a fresh registration window for participants.",
    when: ["ENDED", "SOLD_OUT"],
    confirm: "This will open the registration window and allow new participants to register for the drop.",
    variant: "primary",
  },
  {
    action: "close-registration",
    label: "Close Registration",
    help: "Stop accepting new registrations and freeze the candidate pool.",
    when: ["REGISTRATION_OPEN"],
    confirm: "New participants won't be able to register after this. The candidate pool will be frozen.",
    variant: "secondary",
  },
  {
    action: "generate-queue",
    label: "Draw / Generate Queue",
    help: "Execute cryptographic random shuffle of verified participants into queue order.",
    when: ["REGISTRATION_CLOSED"],
    confirm: "This will run the verifiable random shuffle and assign definitive queue positions to all verified registrants.",
    variant: "primary",
  },
  {
    action: "start-admission",
    label: "Start Admission",
    help: "Admit queued participants in timed batches to hold seats. Resumes after a pause.",
    when: ["QUEUE_READY", "ADMITTING"],
    confirm: "This will begin releasing seats in batches and issuing timed reservation windows.",
    variant: "primary",
  },
  {
    action: "pause",
    label: "Pause Admission",
    help: "Hold the next batch. Existing reservations keep their running countdown timers.",
    when: ["ADMITTING"],
    confirm: "This will temporarily pause new batch admissions. Active reservation hold timers will remain running.",
    variant: "secondary",
  },
  {
    action: "reset",
    label: "Reset Event",
    help: "Clear registrations, queue ordering, and active reservations. Preserves audit logs.",
    when: ["REGISTRATION_OPEN", "REGISTRATION_CLOSED", "QUEUE_READY", "ADMITTING", "SOLD_OUT", "ENDED"],
    confirm: "This clears every registration, queue position, and reservation for this drop. This action CANNOT be undone.",
    danger: true,
    variant: "danger",
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

  // Simulator quick trigger state
  const [simRunning, setSimRunning] = useState(false);
  const [simBusy, setSimBusy] = useState(false);
  const [simProfile, setSimProfile] = useState<"normal" | "high_traffic" | "adversarial">("adversarial");

  const closeToast = useCallback(() => setToast(null), []);
  const cancel = useCallback(() => setConfirming(null), []);
  const phase = event.data?.phase;

  const run = async (a: AdminAction, label: string) => {
    setConfirming(null);
    setPending(a);
    try {
      await api.admin.action(event.eventId, a);
      setToast({ msg: `${label}: lifecycle transition completed successfully.`, tone: "success" });
      event.refresh();
      audit.refresh();
    } catch (e) {
      const err = toApiError(e);
      setToast({
        msg:
          err.status === 409
            ? err.message || "That action is not allowed in the current phase."
            : errorText(err),
        tone: "danger",
      });
    } finally {
      setPending(null);
    }
  };

  const triggerSimulator = async () => {
    setSimBusy(true);
    try {
      if (simRunning) {
        await api.admin.stopSimulator(event.eventId);
        setSimRunning(false);
        setToast({ msg: "Load simulation stopped.", tone: "success" });
      } else {
        const params: SimParams = {
          seats: event.event.seats_total,
          humans: simProfile === "adversarial" ? 0 : 500,
          bots: simProfile === "adversarial" ? 500 : 0,
          bot_rps: 25,
          profiles: ["naive_spammer", "headless_solver", "distributed"],
          traffic_profile: simProfile,
          duration_s: 60,
        };
        await api.admin.runSimulator(event.eventId, params);
        setSimRunning(true);
        setToast({ msg: "Synthetic load simulation started (60s).", tone: "success" });
      }
    } catch (e) {
      setToast({ msg: errorText(toApiError(e)), tone: "danger" });
    } finally {
      setSimBusy(false);
    }
  };

  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return [...(audit.data ?? [])]
      .filter(
        (r) =>
          (kind === "all" || r.kind === kind) &&
          (!needle || `${r.message} ${r.actor} ${AUDIT_LABEL[r.kind]}`.toLowerCase().includes(needle))
      )
      .sort((a, b) => b.t.localeCompare(a.t));
  }, [audit.data, kind, q]);

  return (
    <div className="rise space-y-6">
      <PageHeader
        title={<>Event <em>Settings &amp; Lifecycle</em></>}
        subtitle="Manage drop lifecycle transitions, trigger simulation tests, and inspect the tamper-evident audit ledger."
        badge={phase && <PhaseBadge phase={phase} />}
      />

      {/* Lifecycle Advance Controls */}
      <Panel
        title="Drop Lifecycle Transition"
        subtitle={phase ? `Current lifecycle state: ${phaseName(phase)}` : undefined}
      >
        {event.error && (
          <div className="mb-4">
            <Notice error={event.error} retryIn={event.retryIn} />
          </div>
        )}
        {!phase ? (
          <Skeleton className="h-60" />
        ) : (
          <div className="divide-y divide-zinc-100 -my-4">
            {ACTIONS.map((a) => {
              const enabled = a.when.includes(phase);
              return (
                <div
                  key={a.action}
                  className="flex flex-wrap items-center justify-between gap-4 py-4.5 transition-colors"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className={cx("text-sm font-semibold", enabled ? "text-zinc-900" : "text-zinc-400")}>
                        {a.label}
                      </span>
                      {enabled && (
                        <span className="inline-flex size-2 rounded-full bg-emerald-500 animate-pulse" />
                      )}
                    </div>
                    <p className="mt-0.5 text-xs text-zinc-500 font-normal">{a.help}</p>
                  </div>
                  <Button
                    size="sm"
                    variant={a.danger ? "danger" : a.variant === "primary" ? "primary" : "secondary"}
                    disabled={!enabled || (pending !== null && pending !== a.action)}
                    loading={pending === a.action}
                    onClick={() => setConfirming(a)}
                  >
                    {a.label}
                  </Button>
                </div>
              );
            })}
          </div>
        )}
      </Panel>

      {/* Quick Simulator Run Trigger */}
      <Panel
        title="Quick Simulator Run Trigger"
        subtitle="Execute synthetic load bursts directly from the admin panel to test queue handling."
      >
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="space-y-1">
            <span className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
              Load Profile
            </span>
            <div className="flex items-center gap-2">
              {(["normal", "high_traffic", "adversarial"] as const).map((p) => (
                <button
                  key={p}
                  type="button"
                  disabled={simRunning}
                  onClick={() => setSimProfile(p)}
                  className={cx(
                    "rounded-full px-3 py-1 text-xs font-medium transition-colors",
                    simProfile === p
                      ? "bg-zinc-900 text-white"
                      : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200"
                  )}
                >
                  {p.replace(/_/g, " ")}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Button
              size="sm"
              variant={simRunning ? "danger" : "primary"}
              loading={simBusy}
              onClick={triggerSimulator}
            >
              {simRunning ? "Stop Load Simulation" : "Trigger 60s Simulation"}
            </Button>
          </div>
        </div>
      </Panel>

      {/* Audit Log Ledger */}
      <Panel
        title="Tamper-Evident Audit Ledger"
        subtitle="Cryptographically tracked log of state changes, admissions, security challenges, and operator actions."
      >
        <div className="mb-6 grid gap-4 sm:grid-cols-[220px_1fr]">
          <Select
            label="Filter Kind"
            name="kind"
            value={kind}
            onChange={(e) => setKind(e.target.value as typeof kind)}
          >
            <option value="all">All kinds</option>
            {(Object.keys(AUDIT_LABEL) as AuditEntry["kind"][]).map((k) => (
              <option key={k} value={k}>
                {AUDIT_LABEL[k]}
              </option>
            ))}
          </Select>
          <Input
            label="Search Ledger"
            name="q"
            type="search"
            placeholder="Search message, actor, or event type…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            autoComplete="off"
          />
        </div>

        {audit.error && (
          <div className="mb-4">
            <Notice error={audit.error} retryIn={audit.retryIn} />
          </div>
        )}

        {!audit.data ? (
          <Skeleton className="h-60" />
        ) : rows.length === 0 ? (
          <Empty>{audit.data.length ? "No entries match search filters." : "The audit log is empty."}</Empty>
        ) : (
          <TableWrap>
            <table className="w-full min-w-[620px]">
              <thead>
                <tr className="border-b border-line bg-zinc-50/75">
                  <th className={th}>Timestamp</th>
                  <th className={th}>Action Kind</th>
                  <th className={th}>Actor / Source</th>
                  <th className={th}>Ledger Entry</th>
                </tr>
              </thead>
              <tbody>
                {rows.slice(0, 150).map((r) => (
                  <tr key={r.id} className="hover:bg-zinc-50/60 transition-colors">
                    <td className={`${td} num text-xs font-mono text-zinc-400 whitespace-nowrap`}>
                      {hhmmss(r.t)}
                    </td>
                    <td className={`${td} whitespace-nowrap font-medium text-zinc-900`}>
                      <span className="inline-flex items-center gap-1.5">
                        <span
                          className={`size-1.5 rounded-full ${
                            r.kind === "attack"
                              ? "bg-red-500"
                              : r.kind === "admission" || r.kind === "confirmation"
                              ? "bg-emerald-500"
                              : "bg-zinc-400"
                          }`}
                        />
                        {AUDIT_LABEL[r.kind]}
                      </span>
                    </td>
                    <td className={`${td} text-xs text-zinc-600 font-mono`}>{r.actor}</td>
                    <td className={`${td} text-xs text-zinc-600`}>{r.message}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableWrap>
        )}
      </Panel>

      {/* Confirmation Modal Dialog */}
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
