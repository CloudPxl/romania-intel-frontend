"use client";
import React, { useEffect, useRef, useState } from "react";
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
 *
 * MOTION. Because depth here is shadow-only, the motion vocabulary is built
 * from shadow, light and translation — never from a border appearing or a
 * background tone swapping, which would contradict the one-material rule.
 * Three gestures, used consistently:
 *
 *   arrive  — `.rise` / `.stagger`, a cascading entrance (globals.css).
 *   lift    — hover: -translate-y + `neu-glow`, the card rising toward you.
 *   press   — active: `neu-pressed-sm` + scale-95, the card taking the push.
 *
 * All of it is CSS, deliberately: these are declarative state transitions,
 * so they cost no JavaScript, survive with JS disabled, and keep every page
 * statically prerenderable. Only genuinely imperative motion — counting a
 * number toward a target — uses a hook, and each of those honours
 * `prefers-reduced-motion` itself, since a media query in CSS cannot reach
 * into rAF.
 */

/* ------------------------------------------------------------------ motion */

/** Reads the user's motion preference at call time (never during SSR). */
function prefersReducedMotion(): boolean {
  return typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches === true;
}

/**
 * Counts from the previously displayed number to `value`.
 *
 * Renders 0 on the server AND on the client's first paint, then animates in
 * an effect — starting from the real value instead would hydrate a different
 * string than the server sent. Re-animates from wherever it currently is
 * when `value` changes, so a figure that arrives late (loading -> loaded)
 * still counts up, and one that merely refreshes ticks from its old value
 * rather than snapping back to zero.
 */
export function CountUp({
  value,
  format = (n) => String(Math.round(n)),
  duration = 1100,
  className,
}: {
  value: number;
  format?: (n: number) => string;
  duration?: number;
  className?: string;
}) {
  const [display, setDisplay] = useState(0);
  const currentRef = useRef(0);

  useEffect(() => {
    if (!Number.isFinite(value)) return;
    if (prefersReducedMotion()) {
      currentRef.current = value;
      setDisplay(value);
      return;
    }
    const from = currentRef.current;
    const delta = value - from;
    if (delta === 0) return;

    let frame = 0;
    const started = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - started) / duration);
      // easeOutCubic — matches the decelerating character of --ease-glide,
      // so a number settling and a card settling feel like one system.
      const eased = 1 - Math.pow(1 - t, 3);
      const next = from + delta * eased;
      currentRef.current = next;
      setDisplay(next);
      if (t < 1) frame = requestAnimationFrame(tick);
      else {
        currentRef.current = value;
        setDisplay(value);
      }
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [value, duration]);

  // `tabular` keeps the glyph width fixed so the digits don't jitter as they
  // climb — without it a counting number visibly reflows on every frame.
  return <span className={cn("tabular", className)}>{format(display)}</span>;
}

/**
 * A score or completion bar that fills on mount.
 *
 * Renders at 0 width first, then transitions to the real width one frame
 * later — a CSS transition needs two distinct computed values to animate
 * between, so painting the final width immediately would show no fill at all.
 */
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
  const target = Math.max(0, Math.min(100, (value / max) * 100));
  const [width, setWidth] = useState(0);

  useEffect(() => {
    if (prefersReducedMotion()) {
      setWidth(target);
      return;
    }
    const frame = requestAnimationFrame(() => setWidth(target));
    return () => cancelAnimationFrame(frame);
  }, [target]);

  const toneClass = {
    accent: "bg-editorial",
    positive: "bg-positive",
    negative: "bg-negative",
    warning: "bg-warning",
  }[tone];

  return (
    <div
      className={cn("neu-pressed-sm h-2 w-full overflow-hidden rounded-full bg-paper", className)}
      role="progressbar"
      aria-valuenow={Math.round(value * 10) / 10}
      aria-valuemin={0}
      aria-valuemax={max}
      aria-label={label}
    >
      <div
        className={cn("h-full rounded-full transition-[width] duration-[900ms] ease-[var(--ease-soft)]", toneClass)}
        style={{ width: `${width}%` }}
      />
    </div>
  );
}

/**
 * Hover/focus tooltip for a metric or a truncated string.
 *
 * The wrapper is focusable so the label is reachable by keyboard and not
 * only by pointer, and carries the text as its accessible name — a
 * `role="tooltip"` element alone is announced by nothing unless something
 * references it. Positioned absolutely and `pointer-events-none`, so it can
 * never sit between the cursor and the thing it describes.
 */
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
    <span
      className={cn("group/tip relative inline-flex max-w-full items-center", className)}
      tabIndex={0}
      aria-label={label}
    >
      {children}
      <span
        role="tooltip"
        className={cn(
          "neu-flat pointer-events-none absolute left-1/2 z-50 w-max max-w-[16rem] -translate-x-1/2 scale-95 rounded-xl bg-paper px-3 py-2 text-left font-sans text-xs font-medium leading-snug text-ink opacity-0 transition-all duration-[var(--duration-base)] ease-[var(--ease-glide)]",
          "group-hover/tip:scale-100 group-hover/tip:opacity-100 group-focus-within/tip:scale-100 group-focus-within/tip:opacity-100",
          side === "top"
            ? "bottom-full mb-2 group-hover/tip:-translate-y-0.5 group-focus-within/tip:-translate-y-0.5"
            : "top-full mt-2 group-hover/tip:translate-y-0.5 group-focus-within/tip:translate-y-0.5"
        )}
      >
        {label}
      </span>
    </span>
  );
}

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
  interactive,
}: {
  children: React.ReactNode;
  className?: string;
  as?: React.ElementType;
  /** Opt in to the lift-on-hover gesture. Off by default: a panel that
   *  responds to the pointer implies it can be acted on, so a purely
   *  presentational container should stay still. */
  interactive?: boolean;
}) {
  return (
    <Tag
      className={cn(
        "neu-flat rounded-3xl bg-paper transition-all duration-[var(--duration-base)] ease-[var(--ease-glide)]",
        interactive && "hover:neu-glow hover:-translate-y-1",
        className
      )}
    >
      {children}
    </Tag>
  );
}

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
  /** Secondary content revealed on hover/focus — the density lives here,
   *  out of the resting view, so the default grid stays scannable. */
  detail?: React.ReactNode;
  /** Explains what the metric actually measures. */
  tooltip?: string;
  /**
   * Turns the tile into a click-through to the rows behind the number.
   * The destination must show *exactly* the set this figure counts — a
   * tile reading "135 matched files" that lands on the whole market is
   * worse than one that does not link at all, because the number the user
   * just read no longer reconciles with what they are looking at.
   */
  href?: string;
  /** Affordance text shown on hover when `href` is set. */
  linkLabel?: string;
}) {
  const labelNode = tooltip ? (
    <Tooltip label={tooltip}>
      <Eyebrow className="cursor-help underline decoration-dotted decoration-from-font underline-offset-4">
        {label}
      </Eyebrow>
    </Tooltip>
  ) : (
    <Eyebrow>{label}</Eyebrow>
  );

  const body = (
    <>
      {labelNode}
      <p className="tabular font-display mt-2 text-2xl font-extrabold leading-none text-ink sm:text-3xl">
        {loading ? <span className="animate-pulse text-stock-400">···</span> : value}
      </p>
      {hint && <p className="font-mono mt-2 text-[11px] leading-tight text-stock-500">{hint}</p>}
      {detail && (
        <div className="reveal">
          <div>
            <div className="mt-3 border-t border-divider pt-3 font-body text-xs leading-relaxed text-stock-600">
              {detail}
            </div>
          </div>
        </div>
      )}
    </>
  );

  const shell =
    "group neu-flat rounded-3xl bg-paper p-4 transition-all duration-[var(--duration-base)] ease-[var(--ease-glide)] hover:neu-glow hover:-translate-y-1 sm:p-5";

  if (!href) return <div className={shell}>{body}</div>;

  return (
    <Link href={href} className={cn(shell, "block active:scale-[0.99]")}>
      {body}
      {/* The lift alone reads as decoration on a tile that was static
          until now, so a clickable one also says where it goes — and only
          on hover, keeping the resting grid as quiet as it was. */}
      <span className="reveal">
        <span>
          <span className="font-sans mt-3 inline-flex items-center gap-1 text-[12px] font-medium text-editorial">
            {linkLabel || "Vezi dosarele"}
            <span
              aria-hidden="true"
              className="transition-transform duration-[var(--duration-base)] ease-[var(--ease-spring)] group-hover:translate-x-1"
            >
              →
            </span>
          </span>
        </span>
      </span>
    </Link>
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

// Three states, one physical story: at rest the button is molded up out of
// the surface; on hover it rises further toward the pointer; on press it is
// pushed into the surface (carved shadow + scale-95), so the click has a
// tactile result rather than only a colour change. `active:` is listed after
// `hover:` because a pressed button is still hovered — the later utility has
// to win on equal specificity.
const BUTTON_BASE =
  "neu-flat inline-flex min-h-[44px] items-center justify-center gap-2 rounded-2xl px-5 py-2 text-center font-sans text-sm font-semibold transition-all duration-[var(--duration-base)] ease-[var(--ease-glide)] hover:neu-lift hover:-translate-y-0.5 active:neu-pressed-sm active:translate-y-0 active:scale-95 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:neu-flat disabled:hover:translate-y-0 disabled:active:scale-100";

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
            "min-h-[38px] flex-1 whitespace-nowrap rounded-xl px-4 py-2 font-sans text-sm font-semibold transition-all duration-[var(--duration-base)] ease-[var(--ease-glide)] active:scale-95",
            active === tab.id
              ? "neu-flat-sm bg-paper text-editorial"
              : "text-stock-500 hover:bg-[rgba(255,255,255,0.45)] hover:text-ink"
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

/**
 * Multi-select over a closed vocabulary, as toggleable chips.
 *
 * Used for județe, which were previously a comma-separated text input —
 * an open question asked of a closed set, so an unmatchable value was
 * always one typo away and failed silently. Lives here rather than in a
 * page so onboarding and the criteria editor cannot drift apart.
 */
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
    onChange(
      selected.includes(option)
        ? selected.filter((s) => s !== option)
        : [...selected, option]
    );

  return (
    <div>
      <div className="scroll-x flex max-h-56 flex-wrap gap-1.5 overflow-y-auto p-0.5">
        {options.map((option) => {
          const active = selected.includes(option);
          return (
            <button
              key={option}
              type="button"
              onClick={() => toggle(option)}
              aria-pressed={active}
              className={cn(
                "min-h-[36px] rounded-xl px-3 py-1.5 font-body text-[13px] transition-all duration-[var(--duration-base)] ease-[var(--ease-glide)] active:scale-95",
                active
                  ? "neu-pressed-sm bg-editorial-soft font-medium text-editorial"
                  : "neu-flat-sm bg-paper text-stock-600 hover:neu-lift"
              )}
            >
              {option}
            </button>
          );
        })}
      </div>
      {selected.length === 0 && emptyHint && (
        <p className="font-body mt-2 text-[11px] leading-snug text-stock-500">{emptyHint}</p>
      )}
    </div>
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
