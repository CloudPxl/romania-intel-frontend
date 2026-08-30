"use client";
import React from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";

/**
 * Shared dashboard component vocabulary (file kept as `newsprint.tsx` — the
 * name is an internal module path, not user-facing, and every page already
 * imports from it).
 *
 * Neumorphic (Soft UI) system: every surface is the same cool-grey
 * (`bg-paper`/`bg-surface` are identical), and depth comes only from the
 * `neu-*` shadow utilities defined in globals.css — never from a different
 * background tone or a hard border. An element is either "extruded"
 * (`neu-flat`, molded up out of the surface) or "pressed" (`neu-pressed`,
 * carved into it).
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
    <header className="mb-8">
      <Eyebrow className="text-editorial">{eyebrow}</Eyebrow>
      <div className="mt-2 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <h1 className="font-display text-3xl leading-tight tracking-tight text-ink sm:text-4xl">{title}</h1>
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
      <h2 className="flex items-center gap-2.5 font-display text-base font-bold tracking-tight text-ink sm:text-lg">
        <span className="neu-flat-sm h-2.5 w-2.5 shrink-0 rounded-full bg-editorial" aria-hidden="true" />
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
      <span className="neu-flat-sm h-2 w-2 rounded-full bg-editorial" />
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
  return <Tag className={cn("neu-flat rounded-3xl bg-paper", className)}>{children}</Tag>;
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
    <div className="neu-flat rounded-3xl bg-paper p-4 sm:p-5">
      <Eyebrow>{label}</Eyebrow>
      <p className="tabular font-display mt-2 text-2xl font-extrabold leading-none text-ink sm:text-3xl">
        {loading ? <span className="text-stock-400">···</span> : value}
      </p>
      {hint && <p className="font-mono mt-2 text-[11px] leading-tight text-stock-500">{hint}</p>}
    </div>
  );
}

/** Small status/count pill — a shallow well in the same material, colored text carries the meaning. */
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
    neutral: "text-stock-600",
    accent: "text-editorial",
    positive: "text-positive",
    negative: "text-negative",
    warning: "text-warning",
  };
  return (
    <span
      className={cn(
        "neu-pressed-sm label-eyebrow inline-flex items-center gap-1.5 rounded-full bg-paper px-2.5 py-1 font-sans text-[11px] font-semibold normal-case tracking-normal",
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
  "neu-flat inline-flex min-h-[44px] items-center justify-center gap-2 rounded-2xl px-5 py-2 text-center font-sans text-sm font-semibold transition-all duration-300 ease-out hover:neu-lift hover:-translate-y-px active:neu-pressed-sm active:translate-y-px disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:neu-flat disabled:hover:translate-y-0";

const BUTTON_VARIANTS: Record<ButtonVariant, string> = {
  primary: "bg-editorial text-white",
  outline: "bg-paper text-ink",
  ghost: "bg-paper text-stock-600 hover:text-ink",
  danger: "bg-paper text-negative",
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

/** Segmented tab bar — a pressed-in groove with a raised chip marking the active tab. */
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
      className="neu-pressed scroll-x mb-6 inline-flex w-full gap-1.5 rounded-2xl bg-paper p-1.5"
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
            "min-h-[38px] flex-1 whitespace-nowrap rounded-xl px-4 py-2 font-sans text-sm font-semibold transition-all duration-300",
            active === tab.id ? "neu-flat-sm bg-paper text-editorial" : "text-stock-500 hover:text-ink"
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
  "neu-pressed w-full min-h-[44px] rounded-2xl bg-paper px-4 py-2 font-sans text-sm text-ink transition-shadow duration-300 placeholder:text-stock-400 focus-visible:neu-pressed-deep";

export function Input({ className, ...props }: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={cn(CONTROL, className)} />;
}

export function Textarea({ className, ...props }: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...props} className={cn(CONTROL, "min-h-[7rem] resize-y leading-relaxed", className)} />;
}

const CHEVRON_BG =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='8' viewBox='0 0 12 8'%3E%3Cpath d='M1 1l5 5 5-5' stroke='%236b7280' stroke-width='1.5' fill='none' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E";

export function Select({ className, children, style, ...props }: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      {...props}
      className={cn(
        CONTROL,
        "cursor-pointer appearance-none bg-no-repeat pr-9 disabled:cursor-not-allowed disabled:opacity-50",
        className
      )}
      style={{ backgroundImage: `url("${CHEVRON_BG}")`, backgroundPosition: "right 1rem center", backgroundSize: "12px 8px", ...style }}
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
        className="neu-pressed-sm h-5 w-5 shrink-0 appearance-none rounded-md bg-paper transition-all duration-300 checked:neu-flat-sm checked:[background:var(--color-editorial)]"
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
      ? "border-l-[3px] border-negative text-negative"
      : tone === "warning"
        ? "border-l-[3px] border-warning text-warning"
        : "text-ink";
  return (
    <div className={cn("neu-pressed rounded-2xl bg-paper px-4 py-3 font-body text-sm leading-relaxed", toneClass)} role="status">
      {title && <span className="label-eyebrow mb-1 block opacity-80">{title}</span>}
      {children}
    </div>
  );
}

export function EmptyState({ title, children }: { title: string; children?: React.ReactNode }) {
  return (
    <div className="neu-pressed flex flex-col items-center justify-center rounded-3xl bg-paper px-6 py-16 text-center">
      <Eyebrow className="text-editorial">Fără rezultate</Eyebrow>
      <p className="font-display mt-3 text-xl font-bold text-ink">{title}</p>
      {children && <p className="font-body mt-2 max-w-md text-sm leading-relaxed text-stock-500">{children}</p>}
    </div>
  );
}

export function Loading({ label = "Se încarcă" }: { label?: string }) {
  return (
    <div
      className="neu-pressed flex items-center justify-center gap-3 rounded-3xl bg-paper px-6 py-16"
      role="status"
      aria-live="polite"
    >
      <span className="neu-flat-sm h-2.5 w-2.5 shrink-0 animate-pulse rounded-full bg-editorial" aria-hidden="true" />
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
    <div className="neu-pressed mb-5 rounded-2xl border-l-[3px] border-warning bg-paper px-4 py-3">
      <span className="label-eyebrow text-warning">Date degradate</span>
      <p className="font-body mt-1 text-sm leading-relaxed text-ink">
        {detail || "Baza de date nu a răspuns — sunt afișate ultimele date memorate în cache."}
      </p>
    </div>
  );
}
