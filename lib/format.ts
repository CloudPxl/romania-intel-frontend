/** Romanian-locale formatting helpers shared across every page. */

/**
 * Money is rendered at the magnitude a procurement officer actually talks
 * in — a 42-million-lei road contract is "42,00 Mil. RON", not a 9-digit
 * string nobody can parse at a glance.
 */
export function formatRon(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value) || value === 0) return "—";
  if (value >= 1_000_000_000) return `${(value / 1_000_000_000).toFixed(2)} Mld. RON`;
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(2)} Mil. RON`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)} Mii RON`;
  return `${value.toFixed(0)} RON`;
}

export function formatNumber(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) return "—";
  return new Intl.NumberFormat("ro-RO").format(value);
}

/** Short editorial date: 28 aug. 2026. Returns an em dash on bad input. */
export function formatDate(value: string | null | undefined): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return new Intl.DateTimeFormat("ro-RO", { day: "numeric", month: "short", year: "numeric" }).format(date);
}

/** Full masthead dateline: Vineri, 28 august 2026. */
export function formatDateline(date: Date = new Date()): string {
  const text = new Intl.DateTimeFormat("ro-RO", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(date);
  return text.charAt(0).toUpperCase() + text.slice(1);
}

export function formatPercent(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) return "—";
  return `${value.toFixed(1)}%`;
}

/** Turns `bid_submitted` into `Bid submitted` for stage chips. */
export function humanizeStage(stage: string | null | undefined): string {
  if (!stage) return "—";
  const words = stage.replace(/_/g, " ");
  return words.charAt(0).toUpperCase() + words.slice(1);
}

export const STAGE_LABELS: Record<string, string> = {
  discovery: "Identificat",
  consultation_drafted: "Consultare redactată",
  consultation_submitted: "Consultare depusă",
  caiet_sarcini_analysis: "Analiză caiet sarcini",
  offer_prepared: "Ofertă pregătită",
  bid_submitted: "Ofertă depusă",
  won: "Câștigat",
  lost: "Pierdut",
};

export function stageLabel(stage: string | null | undefined): string {
  if (!stage) return "—";
  return STAGE_LABELS[stage] || humanizeStage(stage);
}

export const CATEGORIES = [
  { id: "infrastructura", label: "Infrastructură & Transporturi" },
  { id: "sanatate", label: "Sănătate & Echipamente Medicale" },
  { id: "energie", label: "Energie & Utilități Verzi" },
  { id: "aparare", label: "Apărare & Securitate" },
  { id: "digitalizare", label: "Digitalizare, IT & Smart City" },
] as const;

export function categoryLabel(id: string | null | undefined): string {
  if (!id) return "General";
  return CATEGORIES.find((c) => c.id === id)?.label || id;
}
