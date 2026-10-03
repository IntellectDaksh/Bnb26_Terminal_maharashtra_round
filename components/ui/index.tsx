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

/** Modern brand mark with signature emerald dot */
export function LogoMark({ className = "size-5" }: { className?: string }) {
  return (
    <span className={cx("relative inline-flex items-center justify-center", className)}>
      <span className="w-2.5 h-2.5 rounded-full bg-emerald-600 shadow-[0_0_8px_rgba(5,150,105,0.4)]"></span>
    </span>
  );
}

export function Wordmark({ className }: { className?: string }) {
  return (
    <span className={cx("inline-flex items-center gap-2.5 text-sm font-semibold tracking-tight uppercase text-zinc-900", className)}>
      <span className="w-2.5 h-2.5 rounded-full bg-emerald-600 shadow-[0_0_8px_rgba(5,150,105,0.4)]"></span>
      Fair Drop
    </span>
  );
}

/* ---------- actions ---------- */

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "soft" | "ghost" | "danger" | "dark";
  size?: "sm" | "md" | "lg";
  loading?: boolean;
};

export const buttonClass = (variant: ButtonProps["variant"] = "primary", size: ButtonProps["size"] = "md") =>
  cx(
    "inline-flex items-center justify-center gap-2 font-semibold transition-all duration-200 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40 touch-manipulation select-none",
    size === "sm" && "h-9 px-4 text-xs rounded-full",
    size === "md" && "h-11 px-6 text-sm rounded-full",
    size === "lg" && "h-13 px-8 text-sm md:text-base rounded-full",
    variant === "primary" && "bg-emerald-600 text-white shadow-lg shadow-emerald-900/10 hover:bg-emerald-500",
    variant === "secondary" && "border border-zinc-200 bg-white text-zinc-900 hover:bg-zinc-50 hover:border-zinc-300 shadow-sm",
    variant === "dark" && "bg-zinc-900 text-white hover:bg-zinc-800 shadow-sm",
    variant === "soft" && "bg-emerald-50 text-emerald-700 hover:bg-emerald-100/80 border border-emerald-200/50",
    variant === "ghost" && "text-zinc-600 hover:text-zinc-900 hover:bg-zinc-100/60 rounded-xl",
    variant === "danger" && "border border-red-200 bg-red-50/50 text-red-600 hover:bg-red-50",
  );

export function Button({ variant, size, loading, disabled, className, children, ...rest }: ButtonProps) {
  return (
    <button {...rest} disabled={disabled || loading} aria-busy={loading || undefined} className={cx(buttonClass(variant, size), className)}>
      {loading && <span className="size-3.5 animate-spin rounded-full border-2 border-current border-r-transparent" aria-hidden />}
      {children}
    </button>
  );
}

/* ---------- forms ---------- */

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement> & { label: string; hint?: string }>(
  function Input({ label, hint, id, className, ...rest }, ref) {
    const fid = id ?? rest.name;
    return (
      <label htmlFor={fid} className="block space-y-1.5">
        <span className="block text-xs font-medium text-zinc-600 ml-1">{label}</span>
        <input ref={ref} id={fid} {...rest} className={cx("form-input", className)} />
        {hint && <span className="mt-1 block text-xs text-zinc-500 ml-1">{hint}</span>}
      </label>
    );
  },
);

export function Select({ label, id, children, className, ...rest }: SelectHTMLAttributes<HTMLSelectElement> & { label: string }) {
  const fid = id ?? rest.name;
  return (
    <label htmlFor={fid} className="block space-y-1.5">
      <span className="block text-xs font-medium text-zinc-600 ml-1">{label}</span>
      <span className="relative block">
        <select id={fid} {...rest} className={cx("form-input appearance-none pr-10 bg-white", className)}>
          {children}
        </select>
        <svg viewBox="0 0 16 16" className="pointer-events-none absolute right-4 top-1/2 size-4 -translate-y-1/2 text-zinc-400" aria-hidden>
          <path d="M4 6l4 4 4-4" stroke="currentColor" strokeWidth="1.5" fill="none" />
        </svg>
      </span>
    </label>
  );
}

export function Checkbox({ label, ...rest }: InputHTMLAttributes<HTMLInputElement> & { label: ReactNode }) {
  return (
    <label className="flex cursor-pointer items-start gap-3 text-sm text-zinc-700">
      <input type="checkbox" {...rest} className="mt-0.5 size-4.5 shrink-0 rounded cursor-pointer accent-emerald-600" />
      <span>{label}</span>
    </label>
  );
}

/* ---------- display ---------- */

export function Card({ className, ...rest }: HTMLAttributes<HTMLDivElement>) {
  return <div {...rest} className={cx("rounded-3xl border border-zinc-200/80 bg-white shadow-sm", className)} />;
}

export function Eyebrow({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cx("eyebrow", className)}>{children}</div>;
}
export const Label = Eyebrow;

export type Tone = "neutral" | "success" | "danger" | "live";

export function StatusBadge({ tone = "neutral", children, className }: { tone?: Tone; children: ReactNode; className?: string }) {
  return (
    <span
      className={cx(
        "inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-wider",
        tone === "neutral" && "bg-zinc-100 text-zinc-600 border border-zinc-200/60",
        (tone === "success" || tone === "live") && "bg-emerald-50 text-emerald-700 border border-emerald-200/70",
        tone === "danger" && "bg-red-50 text-red-600 border border-red-200/70",
        className,
      )}
    >
      <span className={cx("size-1.5 rounded-full bg-current", tone === "live" && "pulse-dot")} aria-hidden />
      {children}
    </span>
  );
}
export const Badge = StatusBadge;

export function MetricCard({ label, value, sub, className }: { label: ReactNode; value: ReactNode; sub?: ReactNode; className?: string }) {
  return (
    <div className={cx("min-w-0 p-5 rounded-2xl bg-zinc-50 border border-zinc-100", className)}>
      <div className="text-xs font-medium uppercase tracking-wider text-zinc-500">{label}</div>
      <div className="num mt-2 truncate text-3xl font-semibold tracking-tight text-zinc-900">{value}</div>
      {sub && <div className="mt-1 truncate text-xs text-zinc-500 font-light">{sub}</div>}
    </div>
  );
}
export const StatNumber = MetricCard;

export function ProgressBar({ value, label, className, tone = "fg" }: { value: number; label: string; className?: string; tone?: "fg" | "success" | "danger" }) {
  const v = Math.max(0, Math.min(1, value));
  return (
    <div
      className={cx("h-2 overflow-hidden rounded-full bg-zinc-100", className)}
      role="progressbar"
      aria-label={label}
      aria-valuenow={Math.round(v * 100)}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <div
        className={cx(
          "h-full rounded-full transition-all duration-700 ease-out",
          tone === "fg" && "bg-emerald-600",
          tone === "success" && "bg-emerald-500",
          tone === "danger" && "bg-red-500",
        )}
        style={{ width: `${v * 100}%` }}
      />
    </div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div aria-hidden className={cx("animate-pulse rounded-xl bg-zinc-200/70", className)} />;
}

export function LoadingDots({ children }: { children: ReactNode }) {
  return (
    <span role="status" className="inline-flex items-baseline gap-0.5 text-sm text-zinc-500">
      {children}
      <span className="dots text-emerald-600" aria-hidden>
        <span>.</span>
        <span>.</span>
        <span>.</span>
      </span>
    </span>
  );
}

/* ---------- time ---------- */

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
            "rise pointer-events-auto rounded-full border bg-white px-5 py-3 text-sm font-medium shadow-xl",
            tone === "danger" ? "border-red-200 text-red-600 bg-red-50/90" : tone === "success" ? "border-emerald-200 text-emerald-700 bg-emerald-50/90" : "border-zinc-200 text-zinc-800",
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
    <div className="fixed inset-0 z-50 grid place-items-center bg-zinc-900/40 p-5 backdrop-blur-sm" onClick={onCancel}>
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="dlg-title"
        className="rise w-full max-w-sm rounded-3xl border border-zinc-200/80 bg-white p-7 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="dlg-title" className="text-xl font-semibold tracking-tight text-zinc-900">
          {title}
        </h2>
        <div className="mt-2 text-sm leading-relaxed text-zinc-600 font-light">{body}</div>
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
    <div className="mx-auto max-w-md py-12 text-center">
      <h1 className="text-3xl font-semibold tracking-tight text-zinc-900">{title}</h1>
      <p className="mt-3 text-sm text-zinc-500 font-light leading-relaxed">{body}</p>
      {action && <div className="mt-8 flex justify-center">{action}</div>}
    </div>
  );
}
