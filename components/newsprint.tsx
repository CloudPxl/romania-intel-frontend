"use client";
import React from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";

/**
 * The Newsprint component vocabulary.
 *
 * Every page composes from these rather than restating border/typography
 * classes inline — that is what keeps the rules single-weight and the
 * type scale consistent across eight routes. Nothing here introduces a
 * border radius; the design's whole geometry depends on that.
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
    <header className="border-b-4 border-ink pb-5 mb-6">
      <Eyebrow className="text-editorial">{eyebrow}</Eyebrow>
      <div className="mt-2 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <h1 className="font-display text-4xl font-black leading-[0.95] tracking-tight sm:text-5xl">{title}</h1>
          {standfirst && (
            <p className="font-body mt-2 max-w-2xl text-sm leading-relaxed text-stock-600">{standfirst}</p>
          )}
        </div>
        {action && <div className="shrink-0">{action}</div>}
      </div>
    </header>
  );
}

export function SectionTitle({ children, note }: { children: React.ReactNode; note?: string }) {
  return (
    <div className="mb-4 flex items-baseline justify-between gap-3 border-b border-ink pb-2">
      <h2 className="font-display text-xl font-bold tracking-tight sm:text-2xl">{children}</h2>
      {note && <span className="label-eyebrow shrink-0 text-stock-500">{note}</span>}
    </div>
  );
}

export function Ornament() {
  return (
    <div aria-hidden="true" className="py-6 text-center font-display text-lg tracking-[0.8em] text-stock-400">
      ✧ ✧ ✧
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
  return <Tag className={cn("border border-ink bg-paper", className)}>{children}</Tag>;
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
      <p className="tabular font-display mt-2 text-3xl font-black leading-none sm:text-4xl">
        {loading ? <span className="text-stock-400">···</span> : value}
      </p>
      {hint && <p className="font-mono mt-2 text-[11px] leading-tight text-stock-500">{hint}</p>}
    </div>
  );
}

/* ----------------------------------------------------------------- actions */

type ButtonVariant = "primary" | "outline" | "ghost" | "danger";

const BUTTON_BASE =
  "inline-flex min-h-[44px] items-center justify-center gap-2 px-4 py-2 text-center font-sans text-xs font-semibold uppercase tracking-widest transition-all duration-200 ease-out disabled:cursor-not-allowed disabled:opacity-40";

const BUTTON_VARIANTS: Record<ButtonVariant, string> = {
  primary: "border border-ink bg-ink text-paper hover:bg-paper hover:text-ink",
  outline: "border border-ink bg-transparent text-ink hover:bg-ink hover:text-paper",
  ghost: "border border-transparent bg-transparent text-ink hover:bg-divider",
  danger: "border border-editorial bg-transparent text-editorial hover:bg-editorial hover:text-paper",
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

/** Segmented tab bar — collapses to a horizontal scroller on narrow screens. */
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
    <div className="scroll-x mb-6 border-y border-ink" role="tablist" aria-label={label}>
      <div className="flex min-w-max">
        {tabs.map((tab, i) => (
          <button
            key={tab.id}
            role="tab"
            aria-selected={active === tab.id}
            onClick={() => onChange(tab.id)}
            className={cn(
              "min-h-[44px] whitespace-nowrap px-4 py-3 font-sans text-[11px] font-semibold uppercase tracking-widest transition-colors duration-200",
              i > 0 && "border-l border-ink",
              active === tab.id ? "bg-ink text-paper" : "text-stock-600 hover:bg-stock-100 hover:text-ink"
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>
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
      <Eyebrow className="mb-1.5 text-stock-600">{label}</Eyebrow>
      {children}
      {hint && <span className="font-mono mt-1 block text-[10px] leading-tight text-stock-500">{hint}</span>}
    </label>
  );
}

const CONTROL =
  "w-full min-h-[44px] border-b-2 border-ink bg-transparent px-3 py-2 font-mono text-sm text-ink transition-colors focus-visible:bg-stock-100 focus-visible:outline-none";

export function Input({ className, ...props }: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={cn(CONTROL, className)} />;
}

export function Textarea({ className, ...props }: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...props} className={cn(CONTROL, "min-h-[7rem] resize-y leading-relaxed", className)} />;
}

export function Select({ className, children, ...props }: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select {...props} className={cn(CONTROL, "pr-8", className)}>
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
    <label className={cn("flex min-h-[44px] cursor-pointer items-center gap-3 font-body text-sm", className)}>
      <input
        type="checkbox"
        {...props}
        className="h-4 w-4 shrink-0 appearance-none border border-ink bg-transparent transition-colors checked:bg-ink"
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
      ? "border-editorial text-editorial"
      : tone === "warning"
        ? "border-ink bg-stock-100"
        : "border-ink";
  return (
    <div className={cn("border-l-4 px-4 py-3 font-body text-sm leading-relaxed", toneClass)} role="status">
      {title && <span className="label-eyebrow mb-1 block">{title}</span>}
      {children}
    </div>
  );
}

export function EmptyState({ title, children }: { title: string; children?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center border border-ink px-6 py-16 text-center">
      <Eyebrow className="text-editorial">Fără rezultate</Eyebrow>
      <p className="font-display mt-3 text-2xl font-bold">{title}</p>
      {children && <p className="font-body mt-2 max-w-md text-sm leading-relaxed text-stock-600">{children}</p>}
    </div>
  );
}

export function Loading({ label = "Se încarcă" }: { label?: string }) {
  return (
    <div className="flex items-center justify-center gap-3 border border-ink px-6 py-16" role="status" aria-live="polite">
      <span className="h-2 w-2 shrink-0 animate-pulse bg-editorial" aria-hidden="true" />
      <span className="label-eyebrow text-stock-600">{label}…</span>
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
    <div className="mb-5 border-2 border-editorial px-4 py-3">
      <span className="label-eyebrow text-editorial">Date degradate</span>
      <p className="font-body mt-1 text-sm leading-relaxed">
        {detail || "Baza de date nu a răspuns — sunt afișate ultimele date memorate în cache."}
      </p>
    </div>
  );
}
