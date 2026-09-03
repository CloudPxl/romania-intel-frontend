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

/**
 * For a single opportunity's own budget field specifically — not for sums,
 * medians, or any other aggregate, where formatRon's plain "—" is correct
 * because those legitimately total to zero.
 *
 * api.py:_row_to_lead has no separate "unpublished" flag: a tender whose
 * authority never stated an estimated value and a (hypothetical) tender
 * genuinely worth 0 RON both arrive as financial_value_ron === 0. Showing
 * "—" or "0 RON" for that reads as a data error on this specific field;
 * naming the actual situation is what the value 0 means here.
 */
export function formatLeadValue(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value) || value === 0) {
    return "Valoare nepublicată";
  }
  return formatRon(value);
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

/**
 * The 41 județe plus București, spelled correctly.
 *
 * Counties used to be a free-text field, which is a closed vocabulary
 * asked as an open question: "Cluj-Napoca", "CJ" or a plain typo saved
 * fine and then matched nothing, with no feedback anywhere. Picking from
 * this list makes an unmatchable value impossible to enter.
 *
 * Diacritics and hyphens are safe here — the backend normalises both
 * sides of the comparison (db._county_key), so "Caraș-Severin" matches
 * the "Caras Severin" the scrapers store.
 */
export const COUNTIES = [
  "Alba", "Arad", "Argeș", "Bacău", "Bihor", "Bistrița-Năsăud", "Botoșani",
  "Brăila", "Brașov", "București", "Buzău", "Călărași", "Caraș-Severin",
  "Cluj", "Constanța", "Covasna", "Dâmbovița", "Dolj", "Galați", "Giurgiu",
  "Gorj", "Harghita", "Hunedoara", "Ialomița", "Iași", "Ilfov", "Maramureș",
  "Mehedinți", "Mureș", "Neamț", "Olt", "Prahova", "Sălaj", "Satu Mare",
  "Sibiu", "Suceava", "Teleorman", "Timiș", "Tulcea", "Vâlcea", "Vaslui",
  "Vrancea",
] as const;
