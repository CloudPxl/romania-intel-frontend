"use client";
import React from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { cn } from "@/lib/utils";

/**
 * Shared component vocabulary (the file keeps its old name — every page
 * imports from it), built on the product's one design system: the same
 * paper ground, 1px lines, teal accent, Geist / Geist Mono and 8 / 12px
 * radii as the public page. Specimens and accessibility rules are on the
 * "Sistem de design" board of the landing-page design canvas:
 *
 *   buttons   44px (40px small), one primary per area, verb + result
 *   fields    visible label, 16px text on phones, error as text + aria
 *   badges    always carry text — colour only reinforces it
 *   cards     <article>/<section> with a real heading
 *   figures   Geist Mono, tabular, with their unit; never animated
 */

/* -------------------------------------------------------------- figures */

/** A figure, shown as is (figures are never animated in this system). */
export function CountUp({
  value,
  format = (n) => String(Math.round(n)),
  className,
}: {
  value: number;
  format?: (n: number) => string;
  duration?: number;
  className?: string;
}) {
  return <span className={cn("tabular", className)}>{Number.isFinite(value) ? format(value) : "—"}</span>;
}

/** A thin score / completion bar. */
export function ProgressBar({
  value,
  max = 10,
  tone = "accent",
  className,
  label,
}: {
  value: number;
  max?: number;
  tone?: "accent" | "positive" | "negative" | "warning";
  className?: string;
  label?: string;
}) {
  const width = Math.max(0, Math.min(100, (value / max) * 100));
  const toneClass = { accent: "bg-editorial", positive: "bg-positive", negative: "bg-negative", warning: "bg-warning" }[tone];
  return (
    <div
      className={cn("h-1.5 w-full overflow-hidden rounded-full bg-surface-2", className)}
      role="progressbar"
      aria-valuenow={Math.round(value * 10) / 10}
      aria-valuemin={0}
      aria-valuemax={max}
      aria-label={label}
    >
      <div className={cn("h-full rounded-full", toneClass)} style={{ width: `${width}%` }} />
    </div>
  );
}

/** Hover/focus hint. Hidden below md (no hover on touch) — `Explainer` is
 *  the tap-reachable alternative. */
export function Tooltip({
  label,
  children,
  side = "top",
  className,
}: {
  label: string;
  children: React.ReactNode;
  side?: "top" | "bottom";
  className?: string;
}) {
  return (
    <span className={cn("group/tip relative inline-flex max-w-full items-center", className)} tabIndex={0} aria-label={label}>
      {children}
      <span
        role="tooltip"
        className={cn(
          "pointer-events-none absolute left-1/2 z-50 hidden w-max max-w-[16rem] -translate-x-1/2 rounded-lg bg-cerneala px-3 py-2 text-left text-[13px] leading-snug text-cerneala-text opacity-0 shadow-float transition-opacity duration-[var(--duration-base)] md:block",
          "group-hover/tip:opacity-100 group-focus-within/tip:opacity-100",
          side === "top" ? "bottom-full mb-2" : "top-full mt-2"
        )}
      >
        {label}
      </span>
    </span>
  );
}

/**
 * The small `?` beside anything technical: a plain-language explanation,
 * click/tap-based and portalled to `body`, so it works on touch and is
 * never clipped by a card's overflow.
 */
export function Explainer({
  title,
  children,
  className,
}: {
  title?: string;
  children: React.ReactNode;
  className?: string;
}) {
  const [open, setOpen] = React.useState(false);
  const [pos, setPos] = React.useState<{ top: number; left: number } | null>(null);
  const btnRef = React.useRef<HTMLButtonElement>(null);
  const popRef = React.useRef<HTMLDivElement>(null);

  const place = React.useCallback(() => {
    const el = btnRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const width = Math.min(320, window.innerWidth - 24);
    const left = Math.min(Math.max(12, r.left + r.width / 2 - width / 2), window.innerWidth - width - 12);
    setPos({ top: r.bottom + 8, left });
  }, []);

  React.useEffect(() => {
    if (!open) return;
    place();
    const onDocClick = (e: MouseEvent) => {
      if (popRef.current?.contains(e.target as Node) || btnRef.current?.contains(e.target as Node)) return;
      setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("keydown", onKey);
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
    };
  }, [open, place]);

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        // Inside a clickable row the "?" must not also open the row.
        onClick={(e) => {
          e.stopPropagation();
          setOpen((v) => !v);
        }}
        // Click/tap, Enter or Space toggles; Esc or a click outside closes.
        // No hover/focus opening: a hover-open followed by the click that
        // meant "open" used to close it again.
        aria-expanded={open}
        aria-label={title ? `Explicație: ${title}` : "Explicație"}
        className={cn(
          // 16px visible; the -m-3 p-3 pair grows the hit area to 40px without moving layout.
          "-m-3 box-content inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full p-3 align-middle text-[10px] font-semibold leading-none text-stock-400 hover:text-accent",
          open && "text-accent",
          className
        )}
      >
        <span className="inline-flex h-4 w-4 items-center justify-center rounded-full border border-current">?</span>
      </button>
      {open && pos && typeof document !== "undefined"
        ? createPortal(
            <div
              ref={popRef}
              role="dialog"
              aria-label={title || "Explicație"}
              style={{ top: pos.top, left: pos.left, width: Math.min(320, window.innerWidth - 24) }}
              className="fixed z-[60] rounded-xl border border-line-strong bg-paper p-4 shadow-float"
            >
              {title && <p className="text-[14px] font-semibold leading-snug text-ink">{title}</p>}
              <div className={cn("text-[14px] leading-relaxed text-stock-500", title && "mt-1")}>{children}</div>
            </div>,
            document.body
          )
        : null}
    </>
  );
}

/* ------------------------------------------------------------- typography */

/** The kicker above a title: 12px, uppercase, accent ink. */
export function Eyebrow({ children, className }: { children: React.ReactNode; className?: string }) {
  return <span className={cn("label-eyebrow block text-stock-600", className)}>{children}</span>;
}

/** A page's head: kicker, title (H2 of the system: 32/38, 24/30 on a
 *  phone), one lead sentence, and the page's own actions. */
export function PageHeader({
  eyebrow,
  title,
  standfirst,
  action,
}: {
  eyebrow?: string;
  title: string;
  standfirst?: string;
  action?: React.ReactNode;
}) {
  return (
    <header className="mb-8 border-b border-line-strong pb-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="min-w-0 flex-1">
          {eyebrow && <p className="label-eyebrow mb-2 text-accent">{eyebrow}</p>}
          <h1 className="text-2xl font-semibold leading-[30px] tracking-[-0.015em] text-ink sm:text-[32px] sm:leading-[38px]">{title}</h1>
          {standfirst && <p className="mt-3 max-w-2xl text-base leading-relaxed text-stock-500 sm:text-[17px]">{standfirst}</p>}
        </div>
        {action && <div className="flex shrink-0 flex-wrap items-center gap-2">{action}</div>}
      </div>
    </header>
  );
}

/** A card or section title — the system's H3 (20/28, 18/26 on a phone). */
export function SectionTitle({ children, note }: { children: React.ReactNode; note?: string }) {
  return (
    <div className="mb-4 flex items-baseline justify-between gap-3 border-b border-divider pb-3">
      <h2 className="text-lg font-semibold leading-[26px] tracking-[-0.01em] text-ink sm:text-xl sm:leading-7">{children}</h2>
      {note && <span className="tabular shrink-0 text-[13px] text-stock-400">{note}</span>}
    </div>
  );
}

export function Ornament() {
  return <hr aria-hidden="true" className="my-10 border-0 border-t border-divider" />;
}

/* ---------------------------------------------------------------- surfaces */

/** A card: white, 1px line, 12px radius. */
export function Panel({
  children,
  className,
  as: Tag = "div",
  interactive,
}: {
  children: React.ReactNode;
  className?: string;
  as?: React.ElementType;
  /** Hover edge for a card that can be acted on. */
  interactive?: boolean;
}) {
  return (
    <Tag
      className={cn(
        "rounded-xl border border-line-strong bg-paper shadow-[0_1px_2px_rgba(17,19,21,0.04)]",
        interactive && "transition-colors duration-[var(--duration-base)] hover:border-stock-400",
        className
      )}
    >
      {children}
    </Tag>
  );
}

/** One figure: the number in mono, its meaning in one line below — the
 *  public page's proof strip. */
export function StatCell({
  label,
  value,
  hint,
  loading,
  detail,
  tooltip,
  href,
  linkLabel,
}: {
  label: string;
  value: React.ReactNode;
  hint?: string;
  loading?: boolean;
  detail?: React.ReactNode;
  tooltip?: string;
  /** Click-through to exactly the rows this figure counts. */
  href?: string;
  linkLabel?: string;
}) {
  const body = (
    <>
      <p className="tabular text-[22px] font-medium leading-[28px] tracking-[-0.03em] text-ink sm:whitespace-nowrap sm:text-[28px] sm:leading-[34px]">
        {loading ? <span className="text-stock-400">—</span> : value}
      </p>
      <p className="mt-2 flex items-center gap-1 text-[14px] leading-5 text-stock-500">
        {label}
        {tooltip && <Explainer title={label}>{tooltip}</Explainer>}
      </p>
      {hint && <p className="tabular mt-1 text-[12px] leading-4 text-stock-400">{hint}</p>}
      {detail && <div className="mt-3 border-t border-divider pt-3 text-[13px] leading-relaxed text-stock-500">{detail}</div>}
      {href && <span className="mt-3 inline-block text-[13px] font-medium text-accent">{linkLabel || "Vezi dosarele"} →</span>}
    </>
  );
  const shell = "block bg-paper p-5 sm:p-6";
  if (!href) return <div className={shell}>{body}</div>;
  return (
    <Link href={href} className={cn(shell, "transition-colors hover:bg-surface-2")}>
      {body}
    </Link>
  );
}

/** StatCells joined by 1px lines inside one card (4 across, 2 on a phone). */
export function StatStrip({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-line-strong bg-line-strong shadow-[0_1px_2px_rgba(17,19,21,0.04)] lg:grid-cols-4", className)}>
      {children}
    </div>
  );
}

/** Pill badge — text always carries the meaning. */
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
    neutral: "bg-surface-2 text-stock-500",
    accent: "bg-editorial-soft text-accent",
    positive: "bg-positive-soft text-positive",
    negative: "bg-negative-soft text-negative",
    warning: "bg-warning-soft text-warning",
  };
  return (
    <span className={cn("inline-flex h-6 items-center gap-1 whitespace-nowrap rounded-full px-2.5 text-[12px] font-semibold leading-none", toneClass[tone], className)}>
      {children}
    </span>
  );
}

/* ----------------------------------------------------------------- actions */

type ButtonVariant = "primary" | "outline" | "ghost" | "danger";

const BUTTON_BASE =
  "inline-flex min-h-11 items-center justify-center gap-2 whitespace-nowrap rounded-lg border border-transparent px-4 text-center text-[15px] font-semibold leading-5 transition-[background-color,border-color,transform] duration-[var(--duration-base)] ease-[var(--ease-glide)] active:translate-y-px disabled:cursor-not-allowed disabled:opacity-45";

const BUTTON_VARIANTS: Record<ButtonVariant, string> = {
  primary: "bg-editorial text-white hover:bg-editorial-light",
  outline: "border-line-strong bg-paper text-ink hover:border-stock-400",
  ghost: "bg-transparent text-ink hover:bg-surface-2",
  danger: "border-negative/40 bg-paper text-negative hover:bg-negative-soft",
};

export function Button({
  variant = "primary",
  className,
  fullWidth,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: ButtonVariant; fullWidth?: boolean }) {
  return <button {...props} className={cn(BUTTON_BASE, BUTTON_VARIANTS[variant], fullWidth && "w-full", className)} />;
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
    <Link href={href} {...props} className={cn(BUTTON_BASE, BUTTON_VARIANTS[variant], fullWidth && "w-full", className)}>
      {children}
    </Link>
  );
}

/** Segmented control (the system's `.seg`). */
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
    <div className="scroll-x mb-6 flex max-w-full gap-1 rounded-[10px] border border-divider bg-surface-2 p-1" role="tablist" aria-label={label}>
      {tabs.map((tab) => (
        <button
          key={tab.id}
          role="tab"
          aria-selected={active === tab.id}
          onClick={() => onChange(tab.id)}
          className={cn(
            "min-h-10 flex-1 whitespace-nowrap rounded-[7px] px-4 text-[14px] font-medium transition-colors duration-[var(--duration-base)]",
            active === tab.id ? "bg-paper text-ink shadow-[0_1px_2px_rgba(20,22,26,0.08)]" : "text-stock-500 hover:text-ink"
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
      <span className="mb-1.5 block text-[14px] font-medium leading-5 text-ink">{label}</span>
      {children}
      {hint && <span className="mt-1.5 block text-[13px] leading-snug text-stock-400">{hint}</span>}
    </label>
  );
}

const CONTROL =
  "w-full min-h-11 rounded-lg border border-line-input bg-paper px-3.5 py-2 text-[15px] text-ink transition-[border-color,box-shadow] duration-[var(--duration-base)] placeholder:text-stock-400 focus:border-editorial focus:shadow-[0_0_0_3px_color-mix(in_srgb,var(--color-editorial)_18%,transparent)] focus:outline-none focus-visible:outline-none aria-[invalid=true]:border-negative disabled:opacity-50";

export function Input({ className, ...props }: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={cn(CONTROL, className)} />;
}

export function Textarea({ className, ...props }: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...props} className={cn(CONTROL, "min-h-[7rem] resize-y leading-relaxed", className)} />;
}

/**
 * A numeric field that can actually be emptied: the text is state while
 * focused and only projected to a number for the caller, so clearing it
 * does not snap back to "0". type="text" + inputMode gives the number pad
 * without the spinner and the scroll-wheel trap.
 */
export function NumberInput({
  value,
  onValueChange,
  decimal = false,
  min,
  max,
  className,
  ...props
}: Omit<React.InputHTMLAttributes<HTMLInputElement>, "value" | "onChange" | "type" | "min" | "max"> & {
  value: number;
  onValueChange: (value: number) => void;
  decimal?: boolean;
  min?: number;
  max?: number;
}) {
  const [draft, setDraft] = React.useState<string | null>(null);
  const shown = draft ?? (Number.isFinite(value) ? String(value) : "");

  const commit = (raw: string) => {
    setDraft(raw);
    if (raw.trim() === "") {
      onValueChange(0);
      return;
    }
    // The Romanian keypad offers a decimal comma.
    const parsed = Number(raw.replace(",", "."));
    if (!Number.isFinite(parsed)) return;
    let next = parsed;
    if (typeof min === "number") next = Math.max(min, next);
    if (typeof max === "number") next = Math.min(max, next);
    onValueChange(next);
  };

  return (
    <input
      {...props}
      type="text"
      inputMode={decimal ? "decimal" : "numeric"}
      value={shown}
      onChange={(e) => commit(e.target.value)}
      onBlur={(e) => {
        setDraft(null);
        props.onBlur?.(e);
      }}
      className={cn(CONTROL, "tabular", className)}
    />
  );
}

const CHEVRON_BG =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='14' height='14' viewBox='0 0 24 24' fill='none' stroke='%235B616B' stroke-width='2' stroke-linecap='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E";

export function Select({ className, children, style, ...props }: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      {...props}
      className={cn(CONTROL, "cursor-pointer appearance-none bg-no-repeat pr-10 disabled:cursor-not-allowed", className)}
      style={{ backgroundImage: `url("${CHEVRON_BG}")`, backgroundPosition: "right 12px center", backgroundSize: "14px 14px", ...style }}
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
    <label className={cn("flex min-h-11 cursor-pointer items-center gap-2.5 text-[15px] text-ink", className)}>
      <input type="checkbox" {...props} className="h-[18px] w-[18px] shrink-0" />
      <span className="leading-snug">{label}</span>
    </label>
  );
}

/** Multi-select over a closed vocabulary, as the system's chips. */
export function ChipSelect({
  options,
  selected,
  onChange,
  emptyHint,
}: {
  options: readonly string[];
  selected: string[];
  onChange: (next: string[]) => void;
  emptyHint?: string;
}) {
  const toggle = (option: string) =>
    onChange(selected.includes(option) ? selected.filter((s) => s !== option) : [...selected, option]);
  return (
    <div>
      <div className="flex max-h-60 flex-wrap gap-2 overflow-y-auto p-px">
        {options.map((option) => {
          const active = selected.includes(option);
          return (
            <button
              key={option}
              type="button"
              onClick={() => toggle(option)}
              aria-pressed={active}
              className={cn(
                "min-h-9 rounded-lg border px-3 text-[14px] transition-colors duration-[var(--duration-base)]",
                active ? "border-editorial-line bg-editorial-soft font-medium text-accent" : "border-line-strong bg-paper text-ink hover:bg-surface-2"
              )}
            >
              {option}
            </button>
          );
        })}
      </div>
      {selected.length === 0 && emptyHint && <p className="mt-2 text-[13px] leading-snug text-stock-400">{emptyHint}</p>}
    </div>
  );
}

/* ------------------------------------------------------------------ states */

/** One line of context. Pages keep at most one per tab. */
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
      ? "border-negative/25 bg-negative-soft"
      : tone === "warning"
        ? "border-warning/25 bg-warning-soft"
        : "border-divider bg-surface-2";
  const titleClass = tone === "alert" ? "text-negative" : tone === "warning" ? "text-warning" : "text-ink";
  return (
    <div className={cn("rounded-lg border px-4 py-3 text-[14px] leading-[21px] text-stock-600", toneClass)} role="status">
      {title && <b className={cn("mb-0.5 block text-[15px] font-semibold", titleClass)}>{title}</b>}
      {children}
    </div>
  );
}

export function EmptyState({ title, children }: { title: string; children?: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-line-strong bg-paper px-6 py-12 text-center">
      <p className="text-lg font-semibold text-ink">{title}</p>
      {children && <div className="mx-auto mt-2 max-w-md text-[15px] leading-relaxed text-stock-500">{children}</div>}
    </div>
  );
}

export function Loading({ label = "Se încarcă" }: { label?: string }) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-line-strong bg-paper px-5 py-8" role="status" aria-live="polite">
      <span className="h-2 w-2 shrink-0 animate-pulse rounded-full bg-editorial" aria-hidden="true" />
      <span className="text-[15px] text-stock-500">{label}…</span>
    </div>
  );
}

/** The backend served a cached snapshot because Postgres was unreachable. */
export function DegradedBanner({ detail }: { detail?: string }) {
  return (
    <div className="mb-5">
      <Notice tone="warning" title="Date din cache">
        {detail || "Baza de date nu a răspuns — sunt afișate ultimele date memorate."}
      </Notice>
    </div>
  );
}

/** An accordion for supporting text (law, method notes) that should stay
 *  one click away — the public page's FAQ row. */
export function Disclosure({
  summary,
  children,
  defaultOpen = false,
  className,
}: {
  summary: React.ReactNode;
  children: React.ReactNode;
  defaultOpen?: boolean;
  className?: string;
}) {
  return (
    <details className={cn("group rounded-xl border border-line-strong bg-paper", className)} open={defaultOpen || undefined}>
      <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-4 px-4 text-[15px] font-semibold text-ink [&::-webkit-details-marker]:hidden">
        {summary}
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true" className="shrink-0 text-stock-400 transition-transform duration-[var(--duration-base)] group-open:rotate-45">
          <path d="M12 5v14" />
          <path d="M5 12h14" />
        </svg>
      </summary>
      <div className="border-t border-divider px-4 py-3 text-[14px] leading-relaxed text-stock-500">{children}</div>
    </details>
  );
}
