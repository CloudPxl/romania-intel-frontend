"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { Check, ChevronDown, Search, X } from "lucide-react";
import type { Lead } from "@/lib/api";
import { COUNTIES, formatLeadValue, formatNumber } from "@/lib/format";
import { ButtonLink, Explainer } from "@/components/newsprint";
import { cn } from "@/lib/utils";

/**
 * The register's shared pieces, one definition each, so a tender reads the
 * same on Prima pagină, Licitații, Analiza pieței and Pipeline — in the
 * design system's own patterns (the public page's alert rows and chips):
 *
 *   LeadList / LeadRow         a tender per row: title, authority, value,
 *                              days left, score — and why it matches
 *   ScoreBadgeWithTooltip      the score pill and what it measures
 *   CountyMultiSelect          the județe picker (search, checkboxes, counts)
 *   FilterChip / FilterOption  a chip in the filter bar, opening a menu
 *   NoResultsRelaxationBanner  0 results under the filters, and the way out
 *   EmptyRegistryState         nothing in the register for this profile yet
 */

/* ------------------------------------------------------------ helpers */

export function daysLeft(deadline?: string | null): number | null {
  if (!deadline) return null;
  const t = Date.parse(deadline);
  if (!Number.isFinite(t)) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.round((t - today.getTime()) / 86400000);
}

export function deadlineTone(days: number | null): string {
  if (days === null || days < 0) return "text-stock-400";
  if (days <= 7) return "text-negative";
  if (days <= 14) return "text-warning";
  return "text-stock-500";
}

export function deadlineLabel(days: number | null): string {
  if (days === null) return "fără termen";
  if (days < 0) return "expirat";
  if (days === 0) return "azi";
  if (days === 1) return "mâine";
  return `în ${days} zile`;
}

/** Lei, readable at a glance: 6,45 mil. lei / 860 mii lei. */
export function compactLei(v?: number | null): string {
  if (!v) return "—";
  const c = (n: number, d: number) => n.toFixed(d).replace(".", ",");
  if (v >= 1e9) return `${c(v / 1e9, 2)} mld. lei`;
  if (v >= 1e6) return `${c(v / 1e6, 2)} mil. lei`;
  if (v >= 1e4) return `${formatNumber(Math.round(v / 1e3))} mii lei`;
  return `${formatNumber(Math.round(v))} lei`;
}

/* ------------------------------------------------------------- score */

export function ScoreBadgeWithTooltip({ lead, className }: { lead: Pick<Lead, "opportunity_score" | "match">; className?: string }) {
  const score = lead.opportunity_score;
  if (score == null) return null;
  const reasons = lead.match?.reasons || [];
  return (
    <span className={cn("inline-flex items-center gap-0.5", className)}>
      <span className="tabular inline-flex h-[22px] items-center rounded-md bg-editorial-soft px-1.5 text-[12px] font-semibold text-accent">
        {score.toLocaleString("ro-RO", { maximumFractionDigits: 1 })}
      </span>
      <Explainer title={`Scor ${score} din 10`}>
        Scorul proiectului (0–10) crește doar cu dovezi din textul anunțului: valoare publicată, termen, cod CPV, sursă de finanțare.
        {lead.match?.is_match && reasons.length > 0 ? ` Se potrivește profilului dvs.: ${reasons.join(", ")}.` : ""}
      </Explainer>
    </span>
  );
}

export function LeadStatus({ lead }: { lead: Lead }) {
  const d = daysLeft(lead.action_deadline);
  const pill = "inline-flex h-6 items-center whitespace-nowrap rounded-full px-2.5 text-[12px] font-semibold";
  if (lead.record_kind === "PRE_TENDER_SIGNAL") return <span className={cn(pill, "bg-warning-soft text-warning")}>Pre-SEAP</span>;
  if (d !== null && d < 0) return <span className={cn(pill, "bg-surface-2 text-stock-500")}>Expirat</span>;
  if (lead.match?.is_match) return <span className={cn(pill, "bg-editorial-soft text-accent")}>Potrivire</span>;
  return null;
}

/* -------------------------------------------------------------- list */

export type LeadSort = "relevance" | "value_desc" | "value_asc" | "deadline_asc" | "score_desc" | "date_desc";

export const SORT_LABELS: Record<LeadSort, string> = {
  relevance: "Relevanță",
  deadline_asc: "Termen apropiat",
  value_desc: "Valoare descrescătoare",
  value_asc: "Valoare crescătoare",
  score_desc: "Scor",
  date_desc: "Cele mai recente",
};

export function sortLeads(leads: Lead[], sort: LeadSort): Lead[] {
  if (sort === "relevance") return leads;
  const copy = [...leads];
  const dl = (l: Lead) => {
    const d = daysLeft(l.action_deadline);
    return d === null || d < 0 ? 1e9 : d;
  };
  copy.sort((a, b) => {
    switch (sort) {
      case "value_desc":
        return (b.financial_value_ron || 0) - (a.financial_value_ron || 0);
      case "value_asc":
        return (a.financial_value_ron || 0) - (b.financial_value_ron || 0);
      case "score_desc":
        return (b.opportunity_score ?? -1) - (a.opportunity_score ?? -1);
      case "date_desc":
        return (b.published_date || "").localeCompare(a.published_date || "");
      case "deadline_asc":
        return dl(a) - dl(b);
    }
    return 0;
  });
  return copy;
}

/** One tender. A real button (the score's "?" stops propagation). */
export function LeadRow({ lead, onOpen, selected, showWhy = true }: { lead: Lead; onOpen: (lead: Lead) => void; selected?: boolean; showWhy?: boolean }) {
  const d = daysLeft(lead.action_deadline);
  const reasons = lead.match?.is_match ? lead.match.reasons : [];
  const meta = [lead.entity_name, lead.county && lead.county !== "Necunoscut" ? lead.county : null].filter(Boolean).join(" · ");
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => onOpen(lead)}
      onKeyDown={(e) => {
        if (e.target !== e.currentTarget) return;
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onOpen(lead);
        }
      }}
      aria-current={selected ? "true" : undefined}
      className={cn(
        "group grid w-full cursor-pointer grid-cols-1 gap-x-4 gap-y-1 border-t border-divider px-4 py-3.5 text-left transition-colors duration-[var(--duration-base)] first:border-t-0 hover:bg-surface-2 sm:grid-cols-[minmax(0,1fr)_auto] sm:px-5",
        selected && "bg-surface-2"
      )}
    >
      <span className="min-w-0">
        <span className={cn("line-clamp-2 block text-[15px] font-[550] leading-[22px] group-hover:text-accent", selected ? "text-accent" : "text-ink")}>
          {lead.project_title}
        </span>
        <span className="mt-0.5 block truncate text-[13px] leading-[19px] text-stock-500">
          {meta || "—"}
          {lead.cpv_code && <span className="tabular"> · CPV {lead.cpv_code}</span>}
        </span>
      </span>
      <span className="flex flex-wrap items-center gap-x-3 sm:block sm:text-right">
        <span className={cn("tabular block text-[14px] leading-[22px]", lead.financial_value_ron ? "text-ink" : "text-stock-400")} title={formatLeadValue(lead.financial_value_ron)}>
          {compactLei(lead.financial_value_ron)}
        </span>
        <span className="flex items-center gap-2 whitespace-nowrap text-[13px] leading-[19px] sm:mt-0.5 sm:justify-end">
          <span className={cn("tabular", deadlineTone(d))}>{deadlineLabel(d)}</span>
          <ScoreBadgeWithTooltip lead={lead} />
        </span>
      </span>
      {(showWhy && reasons.length > 0) || lead.record_kind === "PRE_TENDER_SIGNAL" || (d !== null && d < 0) ? (
        <span className="mt-1 flex flex-wrap sm:col-span-2 items-center gap-x-3 gap-y-1 text-[13px] leading-[19px] text-stock-500">
          <LeadStatus lead={lead} />
          {showWhy &&
            reasons.slice(0, 3).map((r) => (
              <span key={r} className="inline-flex items-center gap-1.5">
                <Check size={13} className="text-positive" aria-hidden />
                {r}
              </span>
            ))}
        </span>
      ) : null}
    </div>
  );
}

/** Tenders as a card of rows. */
export function LeadList({
  leads,
  onOpen,
  selectedId,
  empty,
  footer,
  showWhy,
  className,
}: {
  leads: Lead[];
  onOpen: (lead: Lead) => void;
  selectedId?: string | null;
  empty?: React.ReactNode;
  footer?: React.ReactNode;
  showWhy?: boolean;
  className?: string;
}) {
  return (
    <div className={cn("overflow-hidden rounded-xl border border-line-strong bg-paper", className)}>
      {leads.length === 0 && empty}
      {leads.map((lead) => (
        <LeadRow key={lead.source_id} lead={lead} onOpen={onOpen} selected={selectedId === lead.source_id} showWhy={showWhy} />
      ))}
      {footer && <div className="flex flex-wrap items-center gap-2 border-t border-divider px-4 py-3 text-[13px] text-stock-500 sm:px-5">{footer}</div>}
    </div>
  );
}

/* -------------------------------------------------------- filter chips */

/** A chip in the filter bar ("Județe: Iași, Cluj"), opening a menu. */
export function FilterChip({
  label,
  value,
  children,
  onClear,
  width = 280,
  align = "left",
}: {
  label: string;
  value: string;
  children?: (close: () => void) => React.ReactNode;
  onClear?: () => void;
  width?: number;
  align?: "left" | "right";
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);
  return (
    <div ref={ref} className="relative">
      <span className={cn("inline-flex min-h-9 items-stretch overflow-hidden rounded-lg border bg-paper", onClear ? "border-editorial-line" : "border-line-strong")}>
        <button
          type="button"
          onClick={() => children && setOpen((v) => !v)}
          aria-expanded={children ? open : undefined}
          className="inline-flex items-center gap-1.5 px-3 text-[14px] hover:bg-surface-2"
        >
          <span className="text-stock-400">{label}:</span>
          <span className="max-w-[200px] truncate text-ink">{value}</span>
          {children && <ChevronDown size={14} className="text-stock-400" aria-hidden />}
        </button>
        {onClear && (
          <button type="button" onClick={onClear} aria-label={`Elimină filtrul ${label}`} className="flex w-8 items-center justify-center border-l border-divider text-stock-400 hover:bg-surface-2 hover:text-ink">
            <X size={14} />
          </button>
        )}
      </span>
      {open && children && (
        <div
          className={cn("absolute top-full z-40 mt-1.5 max-w-[calc(100vw-2.5rem)] rounded-xl border border-line-strong bg-paper p-1.5 shadow-float", align === "right" ? "right-0" : "left-0")}
          style={{ width }}
        >
          {children(() => setOpen(false))}
        </div>
      )}
    </div>
  );
}

export function FilterOption({ active, onClick, children, meta }: { active?: boolean; onClick: () => void; children: React.ReactNode; meta?: React.ReactNode }) {
  return (
    <button type="button" onClick={onClick} className="flex min-h-10 w-full items-center gap-2 rounded-lg px-2.5 text-left text-[14px] text-ink hover:bg-surface-2">
      <span className="flex w-4 justify-center text-accent">{active && <Check size={15} />}</span>
      <span className="flex-1 truncate">{children}</span>
      {meta != null && <span className="tabular text-[12px] text-stock-400">{meta}</span>}
    </button>
  );
}

/* ----------------------------------------------------- county picker */

/** Romanian-tolerant fold: "Iasi", "iași", "IAŞI" (cedilla) all match. */
export function foldRo(s: string): string {
  return s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/-/g, " ");
}

/**
 * The județe picker: search (diacritics-tolerant), checkboxes, keyboard
 * (↑/↓ to move, Space/Enter to tick, Esc to close), stays open while
 * several are ticked, bounded scroll however long the list.
 */
export function CountyMultiSelect({
  selected,
  onChange,
  counts,
  options = COUNTIES,
  onDone,
  autoFocus = true,
}: {
  selected: string[];
  onChange: (next: string[]) => void;
  counts?: Record<string, number>;
  options?: readonly string[];
  onDone?: () => void;
  autoFocus?: boolean;
}) {
  const [q, setQ] = useState("");
  const [cursor, setCursor] = useState(0);
  const listRef = useRef<HTMLDivElement>(null);
  const visible = useMemo(() => options.filter((c) => foldRo(c).includes(foldRo(q.trim()))), [options, q]);
  const toggle = (c: string) => onChange(selected.includes(c) ? selected.filter((x) => x !== c) : [...selected, c]);
  const at = Math.min(cursor, Math.max(0, visible.length - 1));

  useEffect(() => {
    listRef.current?.querySelector<HTMLElement>(`[data-i="${at}"]`)?.scrollIntoView({ block: "nearest" });
  }, [at]);

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setCursor(Math.min(at + 1, visible.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setCursor(Math.max(at - 1, 0));
    } else if ((e.key === "Enter" || (e.key === " " && (e.target as HTMLElement).tagName !== "INPUT")) && visible[at]) {
      e.preventDefault();
      toggle(visible[at]);
    } else if (e.key === "Escape" && onDone) {
      e.preventDefault();
      e.stopPropagation();
      onDone();
    }
  };

  return (
    <div onKeyDown={onKey}>
      <label className="flex h-10 items-center gap-2 border-b border-divider px-2.5">
        <Search size={15} className="text-stock-400" aria-hidden />
        <input
          value={q}
          autoFocus={autoFocus}
          onChange={(e) => {
            setQ(e.target.value);
            setCursor(0);
          }}
          placeholder="Caută județ (ex. iasi)…"
          aria-label="Caută județ"
          aria-controls="county-listbox"
          aria-activedescendant={visible[at] ? `county-opt-${at}` : undefined}
          className="h-8 min-w-0 flex-1 bg-transparent text-[14px] text-ink outline-none placeholder:text-stock-400"
        />
      </label>
      <div ref={listRef} id="county-listbox" role="listbox" aria-multiselectable="true" aria-label="Județe" className="max-h-60 overflow-y-auto p-1">
        {visible.map((c, i) => (
          <label
            key={c}
            id={`county-opt-${i}`}
            data-i={i}
            role="option"
            aria-selected={selected.includes(c)}
            onMouseEnter={() => setCursor(i)}
            className={cn("flex min-h-9 cursor-pointer items-center gap-2.5 rounded-lg px-2 text-[14px]", i === at ? "bg-surface-2" : "hover:bg-surface-2")}
          >
            <input type="checkbox" tabIndex={-1} checked={selected.includes(c)} onChange={() => toggle(c)} className="h-4 w-4 accent-[var(--color-editorial)]" />
            <span className="flex-1">{c}</span>
            {counts && counts[c] != null && <span className="tabular text-[12px] text-stock-400">{counts[c]}</span>}
          </label>
        ))}
        {visible.length === 0 && <p className="px-2 py-2 text-[13px] text-stock-400">Niciun județ pentru „{q}”.</p>}
      </div>
      <div className="flex items-center gap-2 border-t border-divider px-2 pt-2">
        <span className="tabular text-[12px] text-stock-500">{selected.length ? `${selected.length} ${selected.length === 1 ? "județ selectat" : "județe selectate"}` : "Toate județele"}</span>
        <span className="flex-1" />
        {selected.length > 0 && (
          <button type="button" onClick={() => onChange([])} className="h-8 rounded-lg px-2.5 text-[13px] text-stock-500 hover:bg-surface-2">
            Șterge selecția
          </button>
        )}
        {onDone && (
          <button type="button" onClick={onDone} className="h-8 rounded-lg bg-editorial px-3 text-[13px] font-semibold text-white hover:bg-editorial-light">
            Gata
          </button>
        )}
      </div>
    </div>
  );
}

/**
 * A form field holding the județe: the selection as removable chips, the
 * searchable list one click away. Replaces the 42-button wall.
 */
export function CountyCombobox({
  label,
  selected,
  onChange,
  emptyHint = "Niciun județ selectat — toată țara.",
}: {
  label: string;
  selected: string[];
  onChange: (next: string[]) => void;
  emptyHint?: string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);
  const shown = selected.slice(0, 6);
  return (
    <div ref={ref} className="relative">
      <span className="mb-1.5 block text-[14px] font-medium leading-5 text-ink">
        {label}
        {selected.length > 0 && <span className="tabular font-normal text-stock-500"> · {selected.length} selectate</span>}
      </span>
      <div className="flex min-h-11 w-full flex-wrap items-center gap-1.5 rounded-lg border border-line-input bg-paper px-2 py-1.5">
        {shown.map((c) => (
          <span key={c} className="inline-flex h-7 items-center gap-1 rounded-md border border-editorial-line bg-editorial-soft pl-2 pr-1 text-[13px] font-medium text-accent">
            {c}
            <button type="button" aria-label={`Elimină ${c}`} onClick={() => onChange(selected.filter((x) => x !== c))} className="flex h-5 w-5 items-center justify-center rounded hover:bg-paper">
              <X size={12} />
            </button>
          </span>
        ))}
        {selected.length > shown.length && <span className="tabular text-[13px] text-stock-500">+{selected.length - shown.length}</span>}
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          aria-haspopup="listbox"
          className="inline-flex min-h-8 flex-1 items-center justify-between gap-2 rounded-md px-1.5 text-left text-[14px] text-stock-500 hover:text-ink"
        >
          <span>{selected.length ? "Adaugă / modifică" : emptyHint}</span>
          <ChevronDown size={15} aria-hidden />
        </button>
      </div>
      {open && (
        <div className="absolute left-0 right-0 top-full z-50 mt-1 rounded-xl border border-line-strong bg-paper pb-2 shadow-float">
          <CountyMultiSelect selected={selected} onChange={onChange} onDone={() => setOpen(false)} />
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------- empty states */

/** The filters exclude everything: name why, offer the way back. */
export function NoResultsRelaxationBanner({
  title,
  message,
  actionLabel,
  onAction,
}: {
  title: string;
  message?: React.ReactNode;
  actionLabel: string;
  onAction: () => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-4 px-5 py-6">
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[10px] bg-editorial-soft text-accent" aria-hidden>
        <Search size={18} />
      </span>
      <div className="min-w-0 flex-[1_1_300px]">
        <p className="text-[16px] font-semibold text-ink">{title}</p>
        {message && <p className="mt-0.5 text-[14px] leading-[21px] text-stock-500">{message}</p>}
      </div>
      <button type="button" onClick={onAction} className="inline-flex min-h-10 items-center gap-2 rounded-lg bg-editorial px-4 text-[14px] font-semibold text-white hover:bg-editorial-light">
        {actionLabel} →
      </button>
    </div>
  );
}

/** The register holds nothing for this profile (yet). */
export function EmptyRegistryState({ onEditCriteria }: { onEditCriteria?: () => void }) {
  return (
    <div className="px-6 py-12 text-center">
      <p className="text-lg font-semibold text-ink">Încă nu sunt licitații pentru acest profil</p>
      <p className="mx-auto mt-2 max-w-md text-[15px] leading-relaxed text-stock-500">
        Registrul se actualizează continuu din SEAP și celelalte surse. Lărgiți criteriile — domeniu, județe, valoare minimă — sau vedeți toată piața.
      </p>
      <div className="mt-5 flex flex-wrap justify-center gap-2">
        {onEditCriteria && (
          <button type="button" onClick={onEditCriteria} className="inline-flex min-h-11 items-center rounded-lg border border-line-strong bg-paper px-4 text-[15px] font-semibold text-ink hover:border-stock-400">
            Editează criteriile
          </button>
        )}
        <ButtonLink href="/analysis">Vezi toată piața</ButtonLink>
      </div>
    </div>
  );
}
