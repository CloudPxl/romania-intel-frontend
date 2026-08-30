"use client";
import React from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";

/**
 * Shared dashboard component vocabulary (file kept as `newsprint.tsx` — the
 * name is an internal module path, not user-facing, and every page already
 * imports from it). Cards, filled inputs, a violet accent, soft radii.
 */

/* ------------------------------------------------------------- typography */

export function Eyebrow({ children, className }: { children: React.ReactNode; className?: string }) {
  return <span className={cn("label-eyebrow block text-stock-500", className)}>{children}</span>;
}

export function PageHeader({
  eyebrow,
  title,
  standfirst,
  action,
}: {
  eyebrow: string;
  title: string;
  standfirst?: string;
  action?: React.ReactNode;
}) {
  return (
    <header className="mb-8 pb-6 border-b border-divider">
      <Eyebrow className="text-editorial">{eyebrow}</Eyebrow>
      <div className="mt-2 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <h1 className="font-display text-3xl font-semibold leading-tight tracking-tight text-ink sm:text-4xl">
            {title}
          </h1>
          {standfirst && (
            <p className="font-body mt-2 max-w-2xl text-sm leading-relaxed text-stock-500">{standfirst}</p>
          )}
        </div>
        {action && <div className="shrink-0">{action}</div>}
      </div>
    </header>
  );
}

export function SectionTitle({ children, note }: { children: React.ReactNode; note?: string }) {
  return (
    <div className="mb-4 flex items-center justify-between gap-3">
      <h2 className="flex items-center gap-2.5 font-display text-base font-semibold tracking-tight text-ink sm:text-lg">
        <span className="h-4 w-1 shrink-0 rounded-full bg-editorial" aria-hidden="true" />
        {children}
      </h2>
      {note && <span className="label-eyebrow shrink-0 text-stock-500">{note}</span>}
    </div>
  );
}

export function Ornament() {
  return (
    <div aria-hidden="true" className="my-8 flex items-center gap-3">
      <span className="h-px flex-1 bg-divider" />
      <span className="h-1.5 w-1.5 rounded-full bg-editorial" />
      <span className="h-px flex-1 bg-divider" />
    </div>
  );
}

/* ---------------------------------------------------------------- surfaces */

export function Panel({
  children,
  className,
  as: Tag = "div",
}: {
  children: React.ReactNode;
  className?: string;
  as?: React.ElementType;
}) {
  return <Tag className={cn("rounded-2xl border border-divider bg-surface", className)}>{children}</Tag>;
}

export function StatCell({
  label,
  value,
  hint,
  loading,
}: {
  label: string;
  value: React.ReactNode;
  hint?: string;
  loading?: boolean;
}) {
  return (
    <div className="p-4 sm:p-5">
      <Eyebrow>{label}</Eyebrow>
      <p className="tabular font-display mt-2 text-2xl font-semibold leading-none text-ink sm:text-3xl">
        {loading ? <span className="text-stock-400">···</span> : value}
      </p>
      {hint && <p className="font-mono mt-2 text-[11px] leading-tight text-stock-500">{hint}</p>}
    </div>
  );
}

/** Small status/count pill — the dashboard equivalent of the old bordered eyebrow tag. */
export function Badge({
  children,
  tone = "neutral",
  className,
}: {
  children: React.ReactNode;
  tone?: "neutral" | "accent" | "positive" | "negative" | "warning";
  className?: string;
}) {
  const toneClass: Record<string, string> = {
    neutral: "bg-stock-100 text-stock-600",
    accent: "bg-editorial-soft text-editorial",
    positive: "bg-positive/10 text-positive",
    negative: "bg-negative/10 text-negative",
    warning: "bg-warning/10 text-warning",
  };
  return (
    <span
      className={cn(
        "label-eyebrow inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 font-sans text-[11px] font-medium normal-case tracking-normal",
        toneClass[tone],
        className
      )}
    >
      {children}
    </span>
  );
}

/* ----------------------------------------------------------------- actions */

type ButtonVariant = "primary" | "outline" | "ghost" | "danger";

const BUTTON_BASE =
  "inline-flex min-h-[44px] items-center justify-center gap-2 rounded-lg px-4 py-2 text-center font-sans text-sm font-medium transition-colors duration-150 ease-out disabled:cursor-not-allowed disabled:opacity-40";

const BUTTON_VARIANTS: Record<ButtonVariant, string> = {
  primary: "bg-editorial text-white hover:brightness-110",
  outline: "border border-divider bg-surface text-ink hover:bg-surface-2",
  ghost: "bg-transparent text-stock-600 hover:bg-surface hover:text-ink",
  danger: "border border-negative/30 bg-transparent text-negative hover:bg-negative/10",
};

export function Button({
  variant = "primary",
  className,
  fullWidth,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: ButtonVariant; fullWidth?: boolean }) {
  return (
    <button
      {...props}
      className={cn(BUTTON_BASE, BUTTON_VARIANTS[variant], fullWidth && "w-full", className)}
    />
  );
}

export function ButtonLink({
  href,
  variant = "primary",
  className,
  fullWidth,
  children,
  ...props
}: React.ComponentProps<typeof Link> & { variant?: ButtonVariant; fullWidth?: boolean }) {
  return (
    <Link
      href={href}
      {...props}
      className={cn(BUTTON_BASE, BUTTON_VARIANTS[variant], fullWidth && "w-full", className)}
    >
      {children}
    </Link>
  );
}

/** Segmented tab bar — a rounded pill track with a filled active tab. */
export function TabBar<T extends string>({
  tabs,
  active,
  onChange,
  label,
}: {
  tabs: readonly { id: T; label: string }[];
  active: T;
  onChange: (id: T) => void;
  label: string;
}) {
  return (
    <div
      className="scroll-x mb-6 inline-flex w-full gap-1 rounded-xl border border-divider bg-surface p-1"
      role="tablist"
      aria-label={label}
    >
      {tabs.map((tab) => (
        <button
          key={tab.id}
          role="tab"
          aria-selected={active === tab.id}
          onClick={() => onChange(tab.id)}
          className={cn(
            "min-h-[38px] flex-1 whitespace-nowrap rounded-lg px-4 py-2 font-sans text-sm font-medium transition-colors duration-150",
            active === tab.id ? "bg-editorial text-white" : "text-stock-500 hover:bg-surface-2 hover:text-ink"
          )}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ inputs */

export function Field({
  label,
  hint,
  children,
  className,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <label className={cn("block", className)}>
      <Eyebrow className="mb-1.5 text-stock-500">{label}</Eyebrow>
      {children}
      {hint && <span className="font-mono mt-1 block text-[10px] leading-tight text-stock-500">{hint}</span>}
    </label>
  );
}

const CONTROL =
  "w-full min-h-[44px] rounded-lg border border-divider bg-surface px-3 py-2 font-sans text-sm text-ink transition-colors placeholder:text-stock-400 focus-visible:border-editorial focus-visible:outline-none";

export function Input({ className, ...props }: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={cn(CONTROL, className)} />;
}

export function Textarea({ className, ...props }: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...props} className={cn(CONTROL, "min-h-[7rem] resize-y leading-relaxed", className)} />;
}

const CHEVRON_BG =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='8' viewBox='0 0 12 8'%3E%3Cpath d='M1 1l5 5 5-5' stroke='%238b8b98' stroke-width='1.5' fill='none' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E";

export function Select({ className, children, style, ...props }: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      {...props}
      className={cn(
        CONTROL,
        "cursor-pointer appearance-none bg-no-repeat pr-8 disabled:cursor-not-allowed disabled:opacity-50",
        className
      )}
      style={{ backgroundImage: `url("${CHEVRON_BG}")`, backgroundPosition: "right 0.75rem center", backgroundSize: "12px 8px", ...style }}
    >
      {children}
    </select>
  );
}

export function Checkbox({
  label,
  className,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement> & { label: string }) {
  return (
    <label className={cn("flex min-h-[44px] cursor-pointer items-center gap-3 font-body text-sm text-ink", className)}>
      <input
        type="checkbox"
        {...props}
        className="h-4 w-4 shrink-0 appearance-none rounded-[4px] border border-divider bg-surface transition-colors checked:border-editorial checked:bg-editorial"
      />
      <span className="leading-snug">{label}</span>
    </label>
  );
}

/* ------------------------------------------------------------------ states */

export function Notice({
  tone = "neutral",
  title,
  children,
}: {
  tone?: "neutral" | "alert" | "warning";
  title?: string;
  children: React.ReactNode;
}) {
  const toneClass =
    tone === "alert"
      ? "border-negative/30 bg-negative/5 text-negative"
      : tone === "warning"
        ? "border-warning/30 bg-warning/5 text-warning"
        : "border-divider bg-surface text-ink";
  return (
    <div className={cn("rounded-xl border px-4 py-3 font-body text-sm leading-relaxed", toneClass)} role="status">
      {title && <span className="label-eyebrow mb-1 block opacity-80">{title}</span>}
      {children}
    </div>
  );
}

export function EmptyState({ title, children }: { title: string; children?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-divider px-6 py-16 text-center">
      <Eyebrow className="text-editorial">Fără rezultate</Eyebrow>
      <p className="font-display mt-3 text-xl font-semibold text-ink">{title}</p>
      {children && <p className="font-body mt-2 max-w-md text-sm leading-relaxed text-stock-500">{children}</p>}
    </div>
  );
}

export function Loading({ label = "Se încarcă" }: { label?: string }) {
  return (
    <div
      className="flex items-center justify-center gap-3 rounded-2xl border border-divider bg-surface px-6 py-16"
      role="status"
      aria-live="polite"
    >
      <span className="h-2 w-2 shrink-0 animate-pulse rounded-full bg-editorial" aria-hidden="true" />
      <span className="label-eyebrow text-stock-500">{label}…</span>
    </div>
  );
}

/**
 * Shown when the backend served a cached snapshot because Postgres was
 * unreachable. An empty feed caused by an outage and a market with no
 * opportunities look identical from the payload alone — the API flags the
 * difference, so the UI has to state it rather than render a calm empty page.
 */
export function DegradedBanner({ detail }: { detail?: string }) {
  return (
    <div className="mb-5 rounded-xl border border-warning/30 bg-warning/5 px-4 py-3">
      <span className="label-eyebrow text-warning">Date degradate</span>
      <p className="font-body mt-1 text-sm leading-relaxed text-ink">
        {detail || "Baza de date nu a răspuns — sunt afișate ultimele date memorate în cache."}
      </p>
    </div>
  );
}
