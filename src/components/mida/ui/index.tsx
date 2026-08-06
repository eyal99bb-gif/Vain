"use client";

// Shared UI primitives. Before these existed the button classes were copied
// into four files and had already drifted — one copy had lost its focus ring.
// Centralising them fixes accessibility globally instead of per component.
import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode } from "react";

const focusRing =
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-mida-accent";

const VARIANTS = {
  primary:
    "bg-mida-accent text-white hover:bg-mida-accent-deep disabled:opacity-60",
  secondary:
    "border border-mida-line bg-mida-surface text-mida-ink hover:border-mida-accent",
  ghost: "text-mida-muted hover:text-mida-ink",
  danger:
    "bg-mida-accent text-white hover:bg-mida-accent-deep disabled:opacity-60",
} as const;

export function Spinner({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg
      className={`${className} mida-spin`}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <circle
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="3"
        className="opacity-25"
      />
      <path
        d="M22 12a10 10 0 0 0-10-10"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
      />
    </svg>
  );
}

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: keyof typeof VARIANTS;
  loading?: boolean;
  /** Full-width by default; set false for inline controls. */
  block?: boolean;
}

export function Button({
  variant = "primary",
  loading = false,
  block = true,
  className = "",
  children,
  disabled,
  ...rest
}: ButtonProps) {
  return (
    <button
      // Keep the label while busy: swapping it for a bare spinner leaves the
      // button with no accessible name mid-action.
      aria-busy={loading || undefined}
      disabled={disabled || loading}
      className={`flex h-12 ${block ? "w-full" : ""} cursor-pointer items-center justify-center gap-2 rounded-full px-6 text-base font-semibold transition-colors duration-200 disabled:cursor-default ${VARIANTS[variant]} ${focusRing} ${className}`}
      {...rest}
    >
      {loading && <Spinner className="h-4 w-4" />}
      {children}
    </button>
  );
}

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  hint?: string;
  error?: string;
}

export function Input({ label, hint, error, id, ...rest }: InputProps) {
  const inputId = id ?? `f-${label.replace(/\s+/g, "-")}`;
  const describedBy = error
    ? `${inputId}-error`
    : hint
      ? `${inputId}-hint`
      : undefined;

  return (
    <label className="flex flex-col gap-1.5" htmlFor={inputId}>
      <span className="text-sm font-medium text-mida-ink">{label}</span>
      <input
        id={inputId}
        aria-describedby={describedBy}
        aria-invalid={error ? true : undefined}
        // 16px minimum: anything smaller makes iOS zoom on focus.
        className={`h-12 w-full rounded-xl border bg-mida-surface px-4 text-base text-mida-ink placeholder:text-mida-placeholder focus:outline-none focus:ring-2 focus:ring-mida-accent/40 ${
          error ? "border-mida-accent" : "border-mida-line focus:border-mida-accent"
        }`}
        {...rest}
      />
      {error ? (
        <span id={`${inputId}-error`} className="text-xs text-mida-accent-deep">
          {error}
        </span>
      ) : hint ? (
        <span id={`${inputId}-hint`} className="text-xs text-mida-muted">
          {hint}
        </span>
      ) : null}
    </label>
  );
}

export function Card({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`rounded-2xl border border-mida-line bg-mida-surface p-4 ${className}`}
    >
      {children}
    </div>
  );
}

export function Banner({
  tone = "info",
  children,
}: {
  tone?: "info" | "warn" | "error";
  children: ReactNode;
}) {
  const tones = {
    info: "border-mida-line bg-mida-surface text-mida-ink",
    warn: "border-amber-300 bg-amber-50 text-amber-900",
    error: "border-mida-accent bg-mida-accent-soft text-mida-accent-deep",
  } as const;
  return (
    <p
      role={tone === "error" ? "alert" : "status"}
      className={`rounded-xl border px-4 py-3 text-sm leading-relaxed ${tones[tone]}`}
    >
      {children}
    </p>
  );
}

export function Skeleton({ className = "" }: { className?: string }) {
  return (
    <div
      className={`mida-pulse rounded-xl bg-mida-line/60 ${className}`}
      aria-hidden="true"
    />
  );
}

export function EmptyState({
  title,
  body,
  action,
}: {
  title: string;
  body: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-mida-line px-6 py-10 text-center">
      <h2 className="font-display text-lg font-bold text-mida-ink">{title}</h2>
      <p className="text-sm leading-relaxed text-mida-muted">{body}</p>
      {action}
    </div>
  );
}

/** Announces async status to screen readers, which spinners cannot. */
export function LiveStatus({ children }: { children: ReactNode }) {
  return (
    <p role="status" aria-live="polite" className="sr-only">
      {children}
    </p>
  );
}
