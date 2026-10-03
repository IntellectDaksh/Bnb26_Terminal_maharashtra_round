"use client";

import {
  forwardRef,
  useEffect,
  useState,
  type ButtonHTMLAttributes,
  type HTMLAttributes,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
} from "react";
import { msUntil } from "@/lib/time";

export const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(" ");

/* ---------- brand ---------- */

/** Partially completed circle: a queue in progress, a drop about to land. */
export function LogoMark({ className = "size-6" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden fill="none">
      <path d="M12 2.5a9.5 9.5 0 1 1-9.02 6.53" stroke="var(--fg)" strokeWidth="2.4" strokeLinecap="round" />
      <circle cx="5.2" cy="5.2" r="2" fill="var(--accent)" />
    </svg>
  );
}

export function Wordmark({ className }: { className?: string }) {
  return (
    <span className={cx("serif inline-flex items-center gap-2 text-[22px] font-semibold tracking-[-0.01em]", className)}>
      <LogoMark className="size-[20px]" />
      Fair Drop
    </span>
  );
}

/* ---------- actions ---------- */

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "soft" | "ghost" | "danger";
  size?: "sm" | "md" | "lg";
  loading?: boolean;
};

export const buttonClass = (variant: ButtonProps["variant"] = "primary", size: ButtonProps["size"] = "md") =>
  cx(
    "inline-flex items-center justify-center gap-2 rounded-full font-semibold transition-[background-color,color,border-color,box-shadow,transform] duration-200 active:translate-y-px disabled:cursor-not-allowed disabled:opacity-45 disabled:active:translate-y-0 touch-manipulation select-none",
    size === "sm" && "h-9 px-4 text-sm",
    size === "md" && "h-11 px-6 text-[15px]",
    size === "lg" && "h-14 px-8 text-base",
    variant === "primary" && "bg-accent text-accent-ink shadow-[0_10px_24px_-12px_rgba(200,100,94,0.7)] hover:bg-[#b9564f]",
    variant === "secondary" && "border border-line bg-surface text-fg hover:border-accent/50",
    variant === "soft" && "bg-accent-soft text-[#8a5a1f] hover:bg-[#f4d9b0]",
    variant === "ghost" && "text-muted hover:text-fg",
    variant === "danger" && "border border-danger/30 text-danger hover:bg-danger/5",
  );

export function Button({ variant, size, loading, disabled, className, children, ...rest }: ButtonProps) {
  return (
    <button {...rest} disabled={disabled || loading} aria-busy={loading || undefined} className={cx(buttonClass(variant, size), className)}>
      {loading && <span className="size-3.5 animate-spin rounded-full border-[1.5px] border-current border-r-transparent" aria-hidden />}
      {children}
    </button>
  );
}

/* ---------- forms ---------- */

const field = "h-12 w-full rounded-xl border border-line bg-surface px-4 text-[15px] text-fg placeholder:text-muted/70 transition-colors focus:border-accent focus:outline-none";

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement> & { label: string; hint?: string }>(
  function Input({ label, hint, id, className, ...rest }, ref) {
    const fid = id ?? rest.name;
    return (
      <label htmlFor={fid} className="block">
        <span className="mb-2 block text-sm font-medium">{label}</span>
        <input ref={ref} id={fid} {...rest} className={cx(field, className)} />
        {hint && <span className="mt-1.5 block text-xs text-muted">{hint}</span>}
      </label>
    );
  },
);

export function Select({ label, id, children, className, ...rest }: SelectHTMLAttributes<HTMLSelectElement> & { label: string }) {
  const fid = id ?? rest.name;
  return (
    <label htmlFor={fid} className="block">
      <span className="mb-2 block text-sm font-medium">{label}</span>
      <span className="relative block">
        <select id={fid} {...rest} className={cx(field, "appearance-none pr-10", className)}>
          {children}
        </select>
        <svg viewBox="0 0 16 16" className="pointer-events-none absolute right-4 top-1/2 size-4 -translate-y-1/2 text-muted" aria-hidden>
          <path d="M4 6l4 4 4-4" stroke="currentColor" strokeWidth="1.5" fill="none" />
        </svg>
      </span>
    </label>
  );
}

export function Checkbox({ label, ...rest }: InputHTMLAttributes<HTMLInputElement> & { label: ReactNode }) {
  return (
    <label className="flex cursor-pointer items-start gap-3 text-sm">
      <input type="checkbox" {...rest} className="mt-0.5 size-[18px] shrink-0 cursor-pointer accent-[#c8645e]" />
      <span>{label}</span>
    </label>
  );
}

/* ---------- display ---------- */

export function Card({ className, ...rest }: HTMLAttributes<HTMLDivElement>) {
  return <div {...rest} className={cx("rounded-[20px] border border-line/80 bg-surface shadow-[var(--shadow-soft)]", className)} />;
}

export function Eyebrow({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cx("eyebrow", className)}>{children}</div>;
}
/** @deprecated alias kept for admin pages */
export const Label = Eyebrow;

export type Tone = "neutral" | "success" | "danger" | "live";

export function StatusBadge({ tone = "neutral", children, className }: { tone?: Tone; children: ReactNode; className?: string }) {
  return (
    <span
      className={cx(
        "inline-flex items-center gap-2 rounded-full px-3 py-1 text-[11px] font-bold uppercase tracking-[0.14em]",
        tone === "neutral" && "bg-bg-2 text-muted",
        (tone === "success" || tone === "live") && "bg-success-soft text-success",
        tone === "danger" && "bg-[#f6e1dd] text-danger",
        className,
      )}
    >
      <span className={cx("size-1.5 rounded-full bg-current", tone === "live" && "pulse-dot")} aria-hidden />
      {children}
    </span>
  );
}
/** @deprecated use StatusBadge */
export const Badge = StatusBadge;

export function MetricCard({ label, value, sub, className }: { label: ReactNode; value: ReactNode; sub?: ReactNode; className?: string }) {
  return (
    <div className={cx("min-w-0", className)}>
      <div className="text-[13px] text-muted">{label}</div>
      <div className="num serif mt-1 truncate text-[34px] font-semibold leading-tight">{value}</div>
      {sub && <div className="mt-1 truncate text-xs text-muted">{sub}</div>}
    </div>
  );
}
/** @deprecated use MetricCard */
export const StatNumber = MetricCard;

export function ProgressBar({ value, label, className, tone = "fg" }: { value: number; label: string; className?: string; tone?: "fg" | "success" | "danger" }) {
  const v = Math.max(0, Math.min(1, value));
  return (
    <div
      className={cx("h-1.5 overflow-hidden rounded-full bg-line", className)}
      role="progressbar"
      aria-label={label}
      aria-valuenow={Math.round(v * 100)}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <div
        className={cx("h-full rounded-full transition-[width] duration-700 ease-out", tone === "fg" && "bg-gradient-to-r from-accent-2 to-accent", tone === "success" && "bg-success", tone === "danger" && "bg-danger")}
        style={{ width: `${v * 100}%` }}
      />
    </div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div aria-hidden className={cx("animate-pulse rounded-md bg-bg-2", className)} />;
}

export function LoadingDots({ children }: { children: ReactNode }) {
  return (
    <span role="status" className="inline-flex items-baseline gap-0.5 text-sm text-muted">
      {children}
      <span className="dots" aria-hidden>
        <span>.</span>
        <span>.</span>
        <span>.</span>
      </span>
    </span>
  );
}

/* ---------- time ---------- */

/** Server-clock countdown. Re-renders 4x/s; reports expiry once. */
export function useCountdown(expiresAt: string | undefined, onExpire?: () => void) {
  const [ms, setMs] = useState(() => (expiresAt ? msUntil(expiresAt) : 0));
  useEffect(() => {
    if (!expiresAt) return;
    let fired = false;
    const tick = () => {
      const left = msUntil(expiresAt);
      setMs(left);
      if (left <= 0 && !fired) {
        fired = true;
        onExpire?.();
      }
    };
    tick();
    const t = setInterval(tick, 250);
    return () => clearInterval(t);
  }, [expiresAt, onExpire]);
  return ms;
}

export const fmtClock = (ms: number) => {
  const s = Math.ceil(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
};

/* ---------- feedback ---------- */

export function Toast({ message, tone = "neutral", onClose }: { message: string | null; tone?: Tone; onClose: () => void }) {
  useEffect(() => {
    if (!message) return;
    const t = setTimeout(onClose, 4000);
    return () => clearTimeout(t);
  }, [message, onClose]);
  return (
    <div aria-live="polite" className="pointer-events-none fixed inset-x-0 bottom-5 z-50 flex justify-center px-4">
      {message && (
        <div
          className={cx(
            "rise pointer-events-auto rounded-full border bg-surface px-5 py-3 text-sm shadow-[var(--shadow-soft)]",
            tone === "danger" ? "border-danger/30 text-danger" : tone === "success" ? "border-success/30 text-success" : "border-line",
          )}
        >
          {message}
        </div>
      )}
    </div>
  );
}

export function Dialog({
  open,
  title,
  body,
  confirmLabel,
  danger,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  body: ReactNode;
  confirmLabel: string;
  danger?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  useEffect(() => {
    if (!open) return;
    const esc = (e: KeyboardEvent) => e.key === "Escape" && onCancel();
    window.addEventListener("keydown", esc);
    return () => window.removeEventListener("keydown", esc);
  }, [open, onCancel]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-fg/25 p-5 backdrop-blur-[2px]" onClick={onCancel}>
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="dlg-title"
        className="rise w-full max-w-sm rounded-[20px] border border-line bg-surface p-7 shadow-[var(--shadow-soft)]"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="dlg-title" className="serif text-2xl font-semibold">
          {title}
        </h2>
        <div className="mt-2 text-sm leading-relaxed text-muted">{body}</div>
        <div className="mt-6 flex justify-end gap-2">
          <Button variant="secondary" size="sm" onClick={onCancel} autoFocus>
            Cancel
          </Button>
          <Button variant={danger ? "danger" : "primary"} size="sm" onClick={onConfirm}>
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}

export function ErrorState({ title, body, action }: { title: string; body: ReactNode; action?: ReactNode }) {
  return (
    <div className="mx-auto max-w-md py-10 text-center">
      <h1 className="display text-4xl sm:text-5xl">{title}</h1>
      <p className="mt-3 leading-relaxed text-muted">{body}</p>
      {action && <div className="mt-8 flex justify-center">{action}</div>}
    </div>
  );
}
