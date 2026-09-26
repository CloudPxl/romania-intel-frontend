"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/context/AuthContext";
import { ApiError, fetchMarketTrends, fetchOpportunitiesPage, fetchOpportunity, type Lead, type MarketTrendFilters, type MarketTrends, type OpportunityPage } from "@/lib/api";
import { CATEGORIES, formatDate, formatNumber, formatRon } from "@/lib/format";
import MarketTrendsView from "@/components/MarketTrendsView";
import LeadDossierPanel from "@/components/LeadDossierPanel";
import {
  Button,
  DegradedBanner,
  EmptyState,
  Eyebrow,
  Field,
  Input,
  Loading,
  Notice,
  PageHeader,
  Panel,
  Select,
  StatCell,
} from "@/components/newsprint";

export default function AnalysisPage() {
  const { user } = useAuth();
  const [data, setData] = useState<MarketTrends | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filtersOpen, setFiltersOpen] = useState(false);

  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [category, setCategory] = useState("");
  const [county, setCounty] = useState("");
  const [minValue, setMinValue] = useState("");
  const [maxValue, setMaxValue] = useState("");
  // Quick-filter only — no field for it in the manual filter panel below,
  // just the "Surse de finanțare" breakdown panel (see quickFilters).
  const [fundingSource, setFundingSource] = useState("");

  // The filters currently in effect, kept separately from the form inputs
  // so a background reload repeats what the user actually applied rather
  // than silently falling back to the unfiltered whole market.
  const [appliedFilters, setAppliedFilters] = useState<MarketTrendFilters>({});
  // Monotonic request id. Without it a slow response can land after a
  // newer one and overwrite it, while `finally` has already cleared the
  // spinner — the numbers change under a UI that says it is done.
  const requestSeq = useRef(0);

  // top_opportunities here is a slim, whole-market projection — not the
  // full Lead shape LeadDossierPanel needs, and not scoped to any one
  // profile's ranked feed (this page's data comes from the public,
  // filtered market view even for a signed-in caller), so opening a
  // record resolves the full row via fetchOpportunity rather than
  // reusing a per-user feed that might not contain it at all.
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const openLead = async (sourceId: string) => {
    try {
      setSelectedLead(await fetchOpportunity(sourceId));
    } catch {
      // Best-effort — the click simply does nothing rather than navigating
      // away, which is no worse than the pre-existing Link behavior.
    }
  };

  const load = useCallback(
    async (filters: MarketTrendFilters = {}) => {
      const seq = ++requestSeq.current;
      setLoading(true);
      setError(null);
      try {
        const result = await fetchMarketTrends(filters);
        if (seq !== requestSeq.current) return;
        setData(result);
      } catch (e) {
        if (seq !== requestSeq.current) return;
        setError(e instanceof ApiError ? e.detail : "Nu s-a putut încărca analiza de piață.");
        setData(null);
      } finally {
        if (seq === requestSeq.current) setLoading(false);
      }
    },
    []
  );

  // The real, paginated "see everything" list behind "Poziții filtrate" —
  // independent of `load` above (which only drives the totals/breakdown
  // panels and the small top_opportunities preview those still carry).
  // Same filters, a separate request, because pagination has to survive a
  // page-2/3/... click without re-running the (heavier) breakdown
  // aggregation query every time.
  const RESULTS_PAGE_SIZE = 20;
  const [resultsPage, setResultsPage] = useState(1);
  const [pageData, setPageData] = useState<OpportunityPage | null>(null);
  const [pageLoading, setPageLoading] = useState(false);
  const pageSeq = useRef(0);

  useEffect(() => {
    const seq = ++pageSeq.current;
    setPageLoading(true);
    fetchOpportunitiesPage(appliedFilters, resultsPage, RESULTS_PAGE_SIZE)
      .then((d) => {
        if (seq === pageSeq.current) setPageData(d);
      })
      .catch(() => {
        if (seq === pageSeq.current) setPageData(null);
      })
      .finally(() => {
        if (seq === pageSeq.current) setPageLoading(false);
      });
  }, [appliedFilters, resultsPage]);

  // Depend on the user's ID, not the user object. `adoptSynced` builds a
  // fresh object on every auth event, and supabase-js re-emits SIGNED_IN on
  // session recovery and TOKEN_REFRESHED on its hourly refresh — so this
  // effect re-ran on a leave-the-tab-open timescale and called load() with
  // NO arguments, wiping the applied filters while the panel kept showing
  // them and the "Filtre (3)" count kept claiming they were active.
  const userId = user?.user_id ?? null;
  useEffect(() => {
    load(appliedFilters);
    // appliedFilters is deliberately excluded: applyFilters() calls load()
    // itself, and including it here would fire a second identical request.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [load, userId]);

  // The full filter set implied by current state, so a quick-filter click
  // (which changes exactly one facet) still keeps whatever the manual
  // panel already had applied — clicking "Cluj" after already filtering
  // to Energie in the panel narrows to both, it doesn't discard the first.
  const buildFilters = (): MarketTrendFilters => ({
    start_date: startDate || undefined,
    end_date: endDate || undefined,
    categories: category ? [category] : undefined,
    counties: county.trim() ? [county.trim()] : undefined,
    funding_sources: fundingSource ? [fundingSource] : undefined,
    min_value_ron: minValue ? Number(minValue) : undefined,
    max_value_ron: maxValue ? Number(maxValue) : undefined,
  });

  const applyFilters = () => {
    const next = buildFilters();
    setAppliedFilters(next);
    setResultsPage(1);
    load(next);
  };

  const resetFilters = () => {
    setStartDate("");
    setEndDate("");
    setCategory("");
    setCounty("");
    setMinValue("");
    setMaxValue("");
    setFundingSource("");
    setAppliedFilters({});
    setResultsPage(1);
    load({});
  };

  // Quick filters (MarketTrendsView's domain/county/funding-source panels):
  // a real, correctly-scoped re-query, same mechanism as the manual panel
  // above — not a client-side narrowing of the already-fetched
  // top_opportunities, which has no guarantee of representing every
  // county or funding source (see MarketTrendsView's quickFilters doc).
  // Each setter takes the fresh value directly rather than reading it back
  // off state (still stale in the same tick it was just set), and merges
  // it into buildFilters()'s otherwise-current snapshot of everything else.
  const selectDomain = (value: string | null) => {
    setCategory(value ?? "");
    const next = { ...buildFilters(), categories: value ? [value] : undefined };
    setAppliedFilters(next);
    setResultsPage(1);
    load(next);
  };
  const selectCounty = (value: string | null) => {
    setCounty(value ?? "");
    const next = { ...buildFilters(), counties: value ? [value] : undefined };
    setAppliedFilters(next);
    setResultsPage(1);
    load(next);
  };
  const selectFundingSource = (value: string | null) => {
    setFundingSource(value ?? "");
    const next = { ...buildFilters(), funding_sources: value ? [value] : undefined };
    setAppliedFilters(next);
    setResultsPage(1);
    load(next);
  };

  const activeFilterCount = Object.keys(data?.filters_applied ?? {}).filter((k) => k !== "limit").length;

  return (
    <main className="mx-auto w-full max-w-screen-xl flex-1 px-4 py-6 sm:py-8">
      <PageHeader
        eyebrow="Analiza de piață"
        title="Unde se concentrează bugetul public"
        standfirst="Agregări recalculate la fiecare interogare din datele curente din registru. Nu există cache la acest nivel — un filtru aplicat interoghează baza de date din nou."
        action={
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => setFiltersOpen((v) => !v)} aria-expanded={filtersOpen}>
              {filtersOpen ? "Ascunde filtre" : `Filtre${activeFilterCount ? ` (${activeFilterCount})` : ""}`}
            </Button>
            <Button variant="outline" onClick={() => load()} disabled={loading}>
              {loading ? "Se încarcă…" : "Reîncarcă"}
            </Button>
          </div>
        }
      />

      {filtersOpen && (
        <Panel className="mb-6 p-4 sm:p-5">
          <Eyebrow className="mb-4">Restrânge analiza</Eyebrow>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <Field label="De la data">
              <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
            </Field>
            <Field label="Până la data">
              <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
            </Field>
            <Field label="Domeniu">
              <Select value={category} onChange={(e) => setCategory(e.target.value)}>
                <option value="">Toate domeniile</option>
                {CATEGORIES.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.label}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Județ">
              <Input value={county} onChange={(e) => setCounty(e.target.value)} placeholder="ex. Cluj" />
            </Field>
            <Field label="Valoare minimă (RON)">
              <Input type="number" inputMode="numeric" min={0} value={minValue} onChange={(e) => setMinValue(e.target.value)} />
            </Field>
            <Field label="Valoare maximă (RON)">
              <Input type="number" inputMode="numeric" min={0} value={maxValue} onChange={(e) => setMaxValue(e.target.value)} />
            </Field>
          </div>
          <div className="mt-5 flex flex-col gap-3 sm:flex-row">
            <Button onClick={applyFilters} disabled={loading}>
              Aplică filtrele
            </Button>
            <Button variant="ghost" onClick={resetFilters} disabled={loading}>
              Resetează
            </Button>
          </div>
        </Panel>
      )}

      {data?.degraded && <DegradedBanner detail={data.detail} />}

      {error && (
        <div className="mb-6">
          <Notice tone="alert" title="Eroare">
            {error}
          </Notice>
        </div>
      )}

      {!data ? (
        loading ? (
          <Loading label="Se calculează agregările" />
        ) : (
          <EmptyState title="Nu există date pentru această selecție">
            {activeFilterCount > 0
              ? "Niciun dosar nu corespunde filtrelor aplicate. Extindeți intervalul sau eliminați un criteriu."
              : "Registrul nu conține încă dosare. Datele apar automat după primul ciclu de scanare."}
          </EmptyState>
        )
      ) : data.total_leads === 0 ? (
        <EmptyState title="Nu există date pentru această selecție">
          {activeFilterCount > 0
            ? "Niciun dosar nu corespunde filtrelor aplicate. Extindeți intervalul sau eliminați un criteriu."
            : "Registrul nu conține încă dosare. Datele apar automat după primul ciclu de scanare."}
        </EmptyState>
      ) : (
        // Once a first result has landed, a later reload (a quick-filter
        // click, Apply, Reset) never unmounts this section — that used to
        // swap the whole page out for the <Loading> block above, which
        // read as the page breaking rather than refreshing. Instead the
        // existing content stays on screen, dimmed and non-interactive,
        // under a small floating loader — same reflex as a search results
        // page re-querying under a still-visible previous result set.
        <div className="relative">
          {loading && (
            <div
              className="absolute inset-0 z-10 flex items-start justify-center rounded-3xl bg-paper/60 pt-24 backdrop-blur-[1px]"
              role="status"
              aria-live="polite"
            >
              <div className="neu-flat flex items-center gap-3 rounded-full bg-paper px-5 py-3">
                <span
                  className="neu-flat-sm h-2.5 w-2.5 shrink-0 animate-pulse rounded-full bg-editorial"
                  aria-hidden="true"
                />
                <span className="label-eyebrow text-stock-500">Se recalculează…</span>
              </div>
            </div>
          )}
          <div className={loading ? "pointer-events-none opacity-60 transition-opacity" : "transition-opacity"}>
            <div className="rule-grid grid grid-cols-2 lg:grid-cols-4">
              <StatCell label="Dosare în selecție" value={formatNumber(data.total_leads)} />
              <StatCell label="Valoare totală" value={formatRon(data.total_market_value_ron)} />
              <StatCell
                label="Scor mediu"
                value={data.average_opportunity_score != null ? `${data.average_opportunity_score} / 10` : "—"}
              />
              <StatCell label="Actualizat" value={formatDate(data.updated_at)} hint={`${data.by_county.length} județe`} />
            </div>

            <div className="mt-8">
              <MarketTrendsView
                data={data}
                variant="full"
                onOpenLead={data.is_authenticated ? openLead : undefined}
                quickFilters={{
                  selectedDomain: category || null,
                  selectedCounty: county || null,
                  selectedFundingSource: fundingSource || null,
                  onSelectDomain: selectDomain,
                  onSelectCounty: selectCounty,
                  onSelectFundingSource: selectFundingSource,
                }}
                results={{
                  items: pageData?.items ?? [],
                  total: pageData?.total ?? 0,
                  page: resultsPage,
                  pageSize: RESULTS_PAGE_SIZE,
                  onPageChange: setResultsPage,
                  loading: pageLoading,
                }}
              />
            </div>

            {data.is_authenticated && (
              <p className="mt-10 border-t border-divider pt-5 text-center">
                <Link href="/cautare-avansata" className="font-sans text-sm font-medium text-editorial hover:brightness-110">
                  Vezi toate dosarele în căutarea avansată →
                </Link>
              </p>
            )}
          </div>
        </div>
      )}

      {selectedLead && <LeadDossierPanel lead={selectedLead} onClose={() => setSelectedLead(null)} />}
    </main>
  );
}
