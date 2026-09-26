"use client";
import { useState } from "react";
import Link from "next/link";
import type { MarketTrends } from "@/lib/api";
import { formatRon } from "@/lib/format";
import { Badge, ButtonLink, Eyebrow, Panel, SectionTitle } from "@/components/newsprint";

/**
 * The county/category/funding-source/top-opportunities breakdown, shared by
 * `/analysis` (the whole market, every row, full detail) and Prima Pagina's
 * personalized view (a trimmed slice of the same shape, scoped to one
 * user's own matches). One component so the two cannot drift the way two
 * hand-copied implementations eventually do — this codebase already hit
 * that exact bug once with a duplicated domain list.
 *
 * Domain/county/funding-source rows are quick, in-place filters over
 * "Cele mai mari poziții" on this same page (click again to clear, AND'd
 * together when more than one is active) rather than a navigation, since
 * narrowing the list you're already looking at is the more useful reflex
 * there — see the `quickFilters` prop for why /analysis needs a real
 * backend re-query to do this correctly rather than a client-side one.
 * The hover treatment (`hover:neu-pressed-sm` + a trailing arrow) deliberately
 * mirrors Căutare Avansată's own lead-list rows rather than a card-lift:
 * these are rows in a divided list, not cards in a grid, and the "whole
 * row presses in on hover" cue is the one this app already uses for
 * "this row opens something."
 */

function RowLink({
  href,
  onSelect,
  active,
  label,
  count,
  value,
  maxValue,
}: {
  /** Navigates to Căutare Avansată. Mutually exclusive with onSelect. */
  href?: string;
  /** In-place toggle filter instead of navigation — see MarketTrendsView's
   *  toggleDomain/toggleCounty/toggleFundingSource. */
  onSelect?: () => void;
  active?: boolean;
  label: string;
  count: number;
  value: number;
  maxValue: number;
}) {
  const pct = maxValue > 0 ? Math.max(2, Math.round((value / maxValue) * 100)) : 0;
  const className =
    "group flex w-full flex-col gap-1.5 rounded-xl px-2 py-2 text-left transition-all duration-[var(--duration-base)] ease-[var(--ease-glide)] hover:neu-pressed-sm active:scale-[0.99]" +
    (active ? " neu-pressed-sm" : "");
  const content = (
    <>
      <div className="flex items-baseline justify-between gap-3">
        <span className="font-body flex min-w-0 items-center gap-1.5 truncate text-sm font-semibold">
          <span className="truncate">{label}</span>
          {href && (
            <span
              aria-hidden="true"
              className="shrink-0 text-editorial opacity-0 transition-all duration-[var(--duration-base)] ease-[var(--ease-spring)] group-hover:translate-x-0.5 group-hover:opacity-100"
            >
              →
            </span>
          )}
          {active && (
            <span className="shrink-0 text-[11px] font-semibold text-editorial" aria-hidden="true">
              · filtrat
            </span>
          )}
        </span>
        <span className="tabular font-mono shrink-0 text-[11px] text-stock-500">
          {count} · {formatRon(value)}
        </span>
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-stock-200">
        <div className="h-full rounded-full bg-editorial" style={{ width: `${pct}%` }} role="presentation" />
      </div>
    </>
  );

  if (onSelect) {
    return (
      <button type="button" onClick={onSelect} className={className} aria-pressed={active}>
        {content}
      </button>
    );
  }
  return (
    <Link href={href!} className={className}>
      {content}
    </Link>
  );
}

function cautareAvansataHref(params: Record<string, string>): string {
  const qs = new URLSearchParams(params).toString();
  return `/cautare-avansata${qs ? `?${qs}` : ""}`;
}

function TopOpportunityRow({
  rank,
  opportunity,
  onOpenLead,
}: {
  rank: number;
  opportunity: MarketTrends["top_opportunities"][number];
  /** When provided, opens the record in place (LeadDossierPanel on the
   *  caller's own page) instead of navigating to Căutare Avansată. Both
   *  Prima Pagina and /analysis wire this for an authenticated caller;
   *  left unset only where there's genuinely nowhere to open it in place
   *  (e.g. an anonymous /analysis visitor, who never sees these rows at
   *  all since top_opportunities is already empty for them). */
  onOpenLead?: (sourceId: string) => void;
}) {
  const content = (
    <>
      <span className="tabular font-mono w-6 shrink-0 pt-0.5 text-sm text-stock-400">
        {String(rank).padStart(2, "0")}
      </span>
      <div className="min-w-0 flex-1">
        <p className="font-body flex items-center gap-1.5 truncate text-sm font-semibold">
          <span className="truncate">{opportunity.project_title}</span>
          <span
            aria-hidden="true"
            className="shrink-0 text-editorial opacity-0 transition-all duration-[var(--duration-base)] ease-[var(--ease-spring)] group-hover:translate-x-0.5 group-hover:opacity-100"
          >
            →
          </span>
        </p>
        <p className="font-mono truncate text-[11px] text-stock-500">
          {opportunity.entity_name} · {opportunity.county}
        </p>
        {/* Two distinct scores, deliberately both shown: Scor proiect is the
            opportunity's own evidence-based quality score, computed once at
            ingestion, independent of any profile. Scor potrivire is this
            profile's relevance score. A high Scor proiect does not imply a
            high Scor potrivire, or the reverse — conflating the two is what
            made a well-evidenced but unrelated lead read as "your best
            match" before this. */}
        <p className="font-mono mt-1 text-[11px] text-stock-500">
          {opportunity.opportunity_score != null && <>Scor proiect {opportunity.opportunity_score}/10</>}
          {opportunity.opportunity_score != null && opportunity.match != null && " · "}
          {opportunity.match != null && <>Scor potrivire {opportunity.match.match_strength}/10</>}
        </p>
        {opportunity.match?.is_match && opportunity.match.reasons.length > 0 && (
          <Badge tone="accent" className="mt-1.5 inline-block">
            Potrivire · {opportunity.match.reasons.join(", ")}
          </Badge>
        )}
      </div>
      <span className="tabular font-display shrink-0 text-sm font-semibold">
        {formatRon(opportunity.financial_value_ron)}
      </span>
    </>
  );

  // A row with no source_id (shouldn't happen from the current backend, but
  // this component has no control over what a caller hands it) degrades to
  // plain text rather than linking to a broken "?openLead=undefined".
  if (!opportunity.source_id) {
    return <li className="flex gap-4 py-2">{content}</li>;
  }
  const rowClassName =
    "group flex w-full gap-4 rounded-xl px-2 py-2 text-left transition-all duration-[var(--duration-base)] ease-[var(--ease-glide)] hover:neu-pressed-sm active:scale-[0.99]";
  if (onOpenLead) {
    const sourceId = opportunity.source_id;
    return (
      <li>
        <button type="button" onClick={() => onOpenLead(sourceId)} className={rowClassName}>
          {content}
        </button>
      </li>
    );
  }
  return (
    <li>
      <Link href={cautareAvansataHref({ openLead: opportunity.source_id })} className={rowClassName}>
        {content}
      </Link>
    </li>
  );
}

export default function MarketTrendsView({
  data,
  variant,
  onOpenLead,
  quickFilters,
}: {
  data: MarketTrends;
  /** "results" is a domain/county/funding-free variant: just the
   *  "Cele mai mari poziții" list, full width — for a caller (Prima
   *  Pagina's profile-criteria toggle cards) that already owns its own
   *  filtering and only needs the results list itself. */
  variant: "full" | "compact" | "results";
  /** See TopOpportunityRow — passed straight through. */
  onOpenLead?: (sourceId: string) => void;
  /**
   * Makes the domain/county/funding-source panels drive a real,
   * correctly-scoped backend re-query (via the caller's own filter state)
   * instead of narrowing the already-fetched top_opportunities
   * client-side. That client-side narrowing is only ever correct by
   * accident: top_opportunities is a small, capped candidate pool (see
   * TOP_OPPORTUNITIES_PER_DOMAIN in routers/analysis.py) with no
   * guarantee of representing every county or funding source, even
   * though the breakdown panels' own counts come from the full dataset —
   * which is exactly how a county showing "2" produced "Nicio poziție în
   * această selecție" when clicked. Only /analysis wires this (it already
   * has real filter infrastructure); Prima Pagina (compact variant) keeps
   * the client-side fallback below, where that same risk is only
   * mitigated, not fixed, by the per-domain guarantee.
   */
  quickFilters?: {
    selectedDomain: string | null;
    selectedCounty: string | null;
    selectedFundingSource: string | null;
    onSelectDomain: (value: string | null) => void;
    onSelectCounty: (value: string | null) => void;
    onSelectFundingSource: (value: string | null) => void;
  };
}) {
  const [localDomain, setLocalDomain] = useState<string | null>(null);
  const [localCounty, setLocalCounty] = useState<string | null>(null);
  const [localFundingSource, setLocalFundingSource] = useState<string | null>(null);

  const selectedDomain = quickFilters ? quickFilters.selectedDomain : localDomain;
  const selectedCounty = quickFilters ? quickFilters.selectedCounty : localCounty;
  const selectedFundingSource = quickFilters ? quickFilters.selectedFundingSource : localFundingSource;

  // Toggle logic lives here regardless of mode, so both paths agree on
  // "click again to clear."
  const toggleDomain = (value: string) => {
    const next = selectedDomain === value ? null : value;
    if (quickFilters) quickFilters.onSelectDomain(next);
    else setLocalDomain(next);
  };
  const toggleCounty = (value: string) => {
    const next = selectedCounty === value ? null : value;
    if (quickFilters) quickFilters.onSelectCounty(next);
    else setLocalCounty(next);
  };
  const toggleFundingSource = (value: string) => {
    const next = selectedFundingSource === value ? null : value;
    if (quickFilters) quickFilters.onSelectFundingSource(next);
    else setLocalFundingSource(next);
  };
  const clearDomain = () => (quickFilters ? quickFilters.onSelectDomain(null) : setLocalDomain(null));
  const clearCounty = () => (quickFilters ? quickFilters.onSelectCounty(null) : setLocalCounty(null));
  const clearFundingSource = () =>
    quickFilters ? quickFilters.onSelectFundingSource(null) : setLocalFundingSource(null);
  const clearFilters = () => {
    if (quickFilters) {
      quickFilters.onSelectDomain(null);
      quickFilters.onSelectCounty(null);
      quickFilters.onSelectFundingSource(null);
    } else {
      setLocalDomain(null);
      setLocalCounty(null);
      setLocalFundingSource(null);
    }
  };

  // Controlled mode: data.top_opportunities is already correctly scoped
  // by the caller's real, server-side query — filtering it again here
  // could only narrow further, never recover a row that's missing purely
  // because it fell outside the (much smaller) uncontrolled-mode pool.
  const filteredOpportunities = quickFilters
    ? data.top_opportunities
    : data.top_opportunities.filter(
        (o) =>
          (!selectedDomain || o.category === selectedDomain) &&
          (!selectedCounty || o.county === selectedCounty) &&
          (!selectedFundingSource || o.funding_source === selectedFundingSource)
      );
  const topOpportunities = variant === "compact" ? filteredOpportunities.slice(0, 5) : filteredOpportunities;
  const maxCategory = Math.max(0, ...data.by_category.map((c) => c.value_ron));
  const maxCounty = Math.max(0, ...data.by_county.map((c) => c.value_ron));
  const maxFunding = Math.max(0, ...data.by_funding_source.map((f) => f.value_ron));

  // The three filter panels below are ~1/3 shorter than before (smaller
  // padding, a tighter row height via RowLink, and a shared max-h scroll
  // cap) specifically so all three can sit on one row on /analysis without
  // the page reading top-heavy — "Cele mai mari poziții" then gets the
  // full width for itself underneath rather than fighting them for a
  // two-column split. The compact variant (Prima Pagina) never shows the
  // county/funding panels at all, so it keeps the original single-domain
  // + results two-up layout unchanged.
  const domainPanel = (
    <Panel as="section" className={variant === "full" ? "p-3 sm:p-4" : "p-4 sm:p-5"}>
      <SectionTitle note={`${data.by_category.length} domenii`}>Distribuție pe domeniu</SectionTitle>
      <div className={variant === "full" ? "-mr-1.25 max-h-56 overflow-y-auto pr-2.25" : undefined}>
        {data.by_category.map((c) => (
          <RowLink
            key={c.category}
            onSelect={() => toggleDomain(c.category)}
            active={selectedDomain === c.category}
            label={c.category}
            count={c.count}
            value={c.value_ron}
            maxValue={maxCategory}
          />
        ))}
      </div>
    </Panel>
  );

  const topOpportunitiesPanel = (
    <Panel as="section" className="p-4 sm:p-5">
        <SectionTitle note={data.is_authenticated ? undefined : "restricționat"}>
          Cele mai mari poziții
        </SectionTitle>
        {data.is_authenticated && (selectedDomain || selectedCounty || selectedFundingSource) && (
          <div className="mb-3 flex flex-wrap items-center gap-1.5">
            {selectedDomain && (
              <button
                type="button"
                onClick={clearDomain}
                className="font-mono neu-pressed-sm inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] text-editorial"
              >
                {selectedDomain} ✕
              </button>
            )}
            {selectedCounty && (
              <button
                type="button"
                onClick={clearCounty}
                className="font-mono neu-pressed-sm inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] text-editorial"
              >
                {selectedCounty} ✕
              </button>
            )}
            {selectedFundingSource && (
              <button
                type="button"
                onClick={clearFundingSource}
                className="font-mono neu-pressed-sm inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] text-editorial"
              >
                {selectedFundingSource} ✕
              </button>
            )}
            {/* Only worth a separate "clear all" once there's more than one
                chip to clear — with a single filter it would just duplicate
                that chip's own ✕. */}
            {[selectedDomain, selectedCounty, selectedFundingSource].filter(Boolean).length > 1 && (
              <button
                type="button"
                onClick={clearFilters}
                className="font-mono ml-1 text-[11px] text-stock-500 underline-offset-2 hover:underline"
              >
                Șterge toate filtrele
              </button>
            )}
          </div>
        )}
        {data.is_authenticated ? (
          topOpportunities.length > 0 ? (
            <ol className="divide-y divide-divider">
              {topOpportunities.map((o, i) => (
                <TopOpportunityRow
                  key={`${o.source_id ?? o.project_title}-${i}`}
                  rank={i + 1}
                  opportunity={o}
                  onOpenLead={onOpenLead}
                />
              ))}
            </ol>
          ) : (
            <p className="font-body text-sm text-stock-500">Nicio poziție în această selecție.</p>
          )
        ) : (
          <div className="neu-pressed rounded-3xl p-6">
            <Eyebrow className="text-editorial">Necesită autentificare</Eyebrow>
            <p className="font-body mt-2 text-sm leading-relaxed text-stock-600">
              Cifrele agregate sunt publice. Pozițiile identificate nominal — autoritate, titlu de proiect, valoare —
              sunt vizibile doar conturilor autentificate.
            </p>
            <ButtonLink href="/login" variant="outline" fullWidth className="mt-5">
              Autentificare
            </ButtonLink>
          </div>
        )}
      </Panel>
  );

  if (variant === "results") {
    // No domain/county/funding breakdown at all — the caller (Prima
    // Pagina's own profile-criteria toggle cards) already owns filtering
    // here, so this variant is just the results list, full width.
    return <div className="w-full">{topOpportunitiesPanel}</div>;
  }

  if (variant !== "full") {
    return (
      <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
        {domainPanel}
        {topOpportunitiesPanel}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-3">
        {domainPanel}

        <Panel as="section" className="p-3 sm:p-4">
          <SectionTitle note={`${data.by_county.length} județe`}>Județe după valoare</SectionTitle>
          {/* Every county, not a top-10 cut — a small county's single
              project used to be invisible here. Scrollable rather than
              letting 40+ rows stretch the card, mirroring how ChipSelect
              already scrolls a long, complete list elsewhere. */}
          <div className="-mr-1.25 max-h-56 overflow-y-auto pr-2.25">
            {data.by_county.map((c) => (
              <RowLink
                key={c.county}
                onSelect={() => toggleCounty(c.county)}
                active={selectedCounty === c.county}
                label={c.county}
                count={c.count}
                value={c.value_ron}
                maxValue={maxCounty}
              />
            ))}
          </div>
        </Panel>

        <Panel as="section" className="p-3 sm:p-4">
          <SectionTitle note={`${data.by_funding_source.length} surse`}>Surse de finanțare</SectionTitle>
          <div className="-mr-1.25 max-h-56 overflow-y-auto pr-2.25">
            {data.by_funding_source.map((f) => (
              <RowLink
                key={f.funding_source}
                onSelect={() => toggleFundingSource(f.funding_source)}
                active={selectedFundingSource === f.funding_source}
                label={f.funding_source}
                count={f.count}
                value={f.value_ron}
                maxValue={maxFunding}
              />
            ))}
          </div>
        </Panel>
      </div>

      {topOpportunitiesPanel}
    </div>
  );
}
