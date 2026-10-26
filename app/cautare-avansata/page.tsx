"use client";
import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Search } from "lucide-react";
import AuthGate from "@/components/AuthGate";
import LeadDossierPanel from "@/components/LeadDossierPanel";
import { ProfileCriteriaModal } from "@/components/EnterpriseModals";
import { ApiError, PROCEDURE_TYPE_LABELS, downloadMyCsv, fetchMyFeed, fetchOpportunity, type Lead } from "@/lib/api";
import { CATEGORIES, categoryLabel, formatDate, formatNumber, formatRon } from "@/lib/format";
import { Button, DegradedBanner, Loading, Notice, PageHeader } from "@/components/newsprint";
import {
  CountyMultiSelect,
  EmptyRegistryState,
  FilterChip,
  FilterOption,
  LeadList,
  NoResultsRelaxationBanner,
  SORT_LABELS,
  sortLeads,
  type LeadSort,
} from "@/components/registry";

const LEGACY_SORTS: Record<string, LeadSort> = {
  budget_desc: "value_desc",
  budget_asc: "value_asc",
  score_desc: "score_desc",
  date_desc: "date_desc",
  deadline: "deadline_asc",
};

/** The register is long; it renders in pages of this many rows. */
const PAGE = 40;

function LicitatiiContent() {
  const searchParams = useSearchParams();

  const [leads, setLeads] = useState<Lead[]>([]);
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [degraded, setDegraded] = useState(false);
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);
  const [criteriaOpen, setCriteriaOpen] = useState(false);
  const [shown, setShown] = useState(PAGE);

  // A click-through (Prima pagină, Analiza pieței, an e-mail alert) names a
  // slice; read once so it does not trigger a second fetch.
  const initialCounty = searchParams.get("county");
  const initialCategory = searchParams.get("category") || "all";
  const initialFundingSource = searchParams.get("fundingSource") || "all";
  const initialOpenLead = searchParams.get("openLead") || searchParams.get("source_id");
  const arrivedWithUrlFilter = Boolean(initialCounty) || initialCategory !== "all" || initialFundingSource !== "all";
  const initialMatchesParam = searchParams.get("matches");
  const initialSort = searchParams.get("sort");

  const [activeCategory, setActiveCategory] = useState<string>(initialCategory);
  // Start on the user's own matches; a link that named a county or category
  // meant the whole slice. An explicit ?matches= wins over both.
  const [onlyMatches, setOnlyMatches] = useState(initialMatchesParam !== null ? initialMatchesParam === "1" : !arrivedWithUrlFilter);
  const [matchDefaultApplied, setMatchDefaultApplied] = useState(arrivedWithUrlFilter || initialMatchesParam !== null);
  const [counties, setCounties] = useState<string[]>(initialCounty ? [initialCounty] : []);
  const [fundingSource, setFundingSource] = useState(initialFundingSource);
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<LeadSort>((initialSort && LEGACY_SORTS[initialSort]) || "relevance");
  // Server-side filters: the CUI commits on Enter, not per keystroke.
  const [cuiDraft, setCuiDraft] = useState("");
  const [authorityCui, setAuthorityCui] = useState("");
  const [procedureType, setProcedureType] = useState("");

  const [toast, setToast] = useState<string | null>(null);
  const [busyCsv, setBusyCsv] = useState(false);

  // Monotonic request id: a slow earlier response must not replace a newer one.
  const feedSeq = useRef(0);

  const loadFeed = useCallback(
    async (force = false) => {
      const seq = ++feedSeq.current;
      if (force) setRefreshing(true);
      else setLoading(true);
      setError(null);
      try {
        const feed = await fetchMyFeed(activeCategory, force, {
          authorityCui: authorityCui || undefined,
          procedureType: procedureType || undefined,
        });
        if (seq !== feedSeq.current) return;
        setLeads(feed.leads || []);
        setDegraded(Boolean(feed.degraded));
        setUpdatedAt(feed.data_updated_at);
      } catch (e) {
        if (seq !== feedSeq.current) return;
        setError(e instanceof ApiError ? e.detail : "Nu s-a putut încărca registrul.");
        setLeads([]);
      } finally {
        if (seq === feedSeq.current) {
          setLoading(false);
          setRefreshing(false);
        }
      }
    },
    [activeCategory, authorityCui, procedureType]
  );

  useEffect(() => {
    loadFeed(false);
  }, [loadFeed]);

  // A profile that matches nothing would open on an empty list; fall back
  // to the whole market once, and say why.
  useEffect(() => {
    if (loading || matchDefaultApplied || leads.length === 0) return;
    if (!leads.some((l) => l.match?.is_match)) setOnlyMatches(false);
    setMatchDefaultApplied(true);
  }, [loading, leads, matchDefaultApplied]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(t);
  }, [toast]);

  const closeDossier = useCallback(() => {
    setSelectedLead(null);
    // A refresh should show the list, not reopen the dossier just closed.
    if (initialOpenLead && typeof window !== "undefined") {
      const url = new URL(window.location.href);
      url.searchParams.delete("openLead");
      url.searchParams.delete("source_id");
      window.history.replaceState(null, "", url.pathname + url.search);
    }
  }, [initialOpenLead]);

  // A link naming one dossier opens it by id, from the whole register — not
  // only from this user's ranked slice.
  useEffect(() => {
    if (!initialOpenLead) return;
    let mounted = true;
    fetchOpportunity(initialOpenLead)
      .then((lead) => mounted && setSelectedLead(lead))
      .catch((e) => {
        if (!mounted) return;
        setToast(
          e instanceof ApiError && e.status === 404
            ? `Dosarul ${initialOpenLead} nu mai există în registru (anunț retras sau expirat).`
            : "Dosarul din link nu a putut fi deschis acum — reîncercați."
        );
      });
    return () => {
      mounted = false;
    };
  }, [initialOpenLead]);

  const countyCounts = useMemo(() => {
    const out: Record<string, number> = {};
    leads.forEach((l) => l.county && (out[l.county] = (out[l.county] || 0) + 1));
    return out;
  }, [leads]);

  const fundingSources = useMemo(() => {
    const set = new Set<string>();
    leads.forEach((l) => l.funding_source && set.add(l.funding_source));
    return Array.from(set).sort((a, b) => a.localeCompare(b, "ro"));
  }, [leads]);

  const visibleLeads = useMemo(() => {
    const fold = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
    const q = fold(query.trim());
    const wanted = new Set(counties.map(fold));
    const filtered = leads.filter((l) => {
      if (onlyMatches && !l.match?.is_match) return false;
      if (wanted.size && !wanted.has(fold(l.county || ""))) return false;
      if (fundingSource !== "all" && fold(l.funding_source || "") !== fold(fundingSource)) return false;
      if (q) {
        const hay = fold([l.project_title, l.entity_name, l.locality, l.sub_category, l.county, l.cpv_code, l.source_id].filter(Boolean).join(" "));
        if (!hay.includes(q)) return false;
      }
      return true;
    });
    // "relevance" keeps the server's ranking — the whole feed is built on it.
    return sortLeads(filtered, sort);
  }, [leads, query, counties, fundingSource, onlyMatches, sort]);

  useEffect(() => setShown(PAGE), [visibleLeads]);

  const totalValue = visibleLeads.reduce((sum, l) => sum + (l.financial_value_ron || 0), 0);
  const noMatchesForProfile = !loading && leads.length > 0 && !leads.some((l) => l.match?.is_match);
  const filtersActive =
    counties.length > 0 || fundingSource !== "all" || query.trim() !== "" || activeCategory !== "all" || !!authorityCui || !!procedureType;

  const resetFilters = () => {
    setMatchDefaultApplied(true);
    setOnlyMatches(false);
    setCounties([]);
    setFundingSource("all");
    setQuery("");
    setActiveCategory("all");
    setCuiDraft("");
    setAuthorityCui("");
    setProcedureType("");
  };

  const handleExport = async () => {
    setBusyCsv(true);
    try {
      await downloadMyCsv();
    } catch (e) {
      setToast(e instanceof ApiError ? e.detail : "Exportul CSV a eșuat.");
    } finally {
      setBusyCsv(false);
    }
  };

  // Which filter removed the rows, so the banner can name it.
  const relaxation = (() => {
    if (onlyMatches && leads.some((l) => !l.match?.is_match))
      return {
        title: "Nicio potrivire pentru filtrele curente",
        label: "Caută în toată piața",
        action: () => {
          setMatchDefaultApplied(true);
          setOnlyMatches(false);
        },
      };
    if (query.trim()) return { title: `0 rezultate pentru „${query.trim()}”`, label: "Șterge căutarea", action: () => setQuery("") };
    if (counties.length) return { title: "Niciun rezultat în județele alese", label: "Toate județele", action: () => setCounties([]) };
    return { title: "Niciun rezultat pentru filtrele curente", label: "Resetează filtrele", action: resetFilters };
  })();

  const pick = (fn: () => void, close: () => void) => () => {
    fn();
    close();
  };

  return (
    <main className="mx-auto w-full max-w-[1264px] flex-1 px-5 pb-16 pt-8 sm:px-8 sm:pt-12">
      <PageHeader
        eyebrow="Registru"
        title="Licitații"
        standfirst={
          loading
            ? "Se încarcă registrul…"
            : `${formatNumber(visibleLeads.length)} din ${formatNumber(leads.length)} dosare · ${formatRon(totalValue)} · sincronizat ${formatDate(updatedAt)}`
        }
        action={
          <>
            <Button variant="outline" onClick={() => loadFeed(true)} disabled={refreshing}>
              {refreshing ? "Se actualizează…" : "Actualizează"}
            </Button>
            <Button variant="outline" onClick={handleExport} disabled={busyCsv}>
              {busyCsv ? "Se exportă…" : "Export CSV"}
            </Button>
          </>
        }
      />

      <div className="mb-6 flex flex-wrap items-center gap-2" role="toolbar" aria-label="Filtre">
        <label className="relative w-full sm:w-[300px]">
          <span className="sr-only">Caută în registru</span>
          <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-stock-400" aria-hidden />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Proiect, autoritate, CPV…"
            className="h-10 w-full rounded-lg border border-line-input bg-paper pl-9 pr-3 text-[15px] text-ink outline-none placeholder:text-stock-400 focus:border-editorial focus:shadow-[0_0_0_3px_color-mix(in_srgb,var(--color-editorial)_18%,transparent)]"
          />
        </label>
        <FilterChip label="Afișez" value={onlyMatches ? "potrivirile mele" : "toată piața"} width={280}>
          {(close) => (
            <>
              <FilterOption active={onlyMatches} onClick={pick(() => { setMatchDefaultApplied(true); setOnlyMatches(true); }, close)}>
                Doar potrivirile mele
              </FilterOption>
              <FilterOption active={!onlyMatches} onClick={pick(() => { setMatchDefaultApplied(true); setOnlyMatches(false); }, close)}>
                Toată piața, ordonată după potrivire
              </FilterOption>
            </>
          )}
        </FilterChip>
        <FilterChip label="Domeniu" value={activeCategory === "all" ? "toate" : categoryLabel(activeCategory)} width={320} onClear={activeCategory !== "all" ? () => setActiveCategory("all") : undefined}>
          {(close) => (
            <>
              <FilterOption active={activeCategory === "all"} onClick={pick(() => setActiveCategory("all"), close)}>
                Toate domeniile
              </FilterOption>
              {CATEGORIES.map((c) => (
                <FilterOption key={c.id} active={activeCategory === c.id} onClick={pick(() => setActiveCategory(c.id), close)}>
                  {c.label}
                </FilterOption>
              ))}
            </>
          )}
        </FilterChip>
        <FilterChip
          label="Județe"
          value={counties.length === 0 ? "toate" : counties.length <= 2 ? counties.join(", ") : `${counties.slice(0, 2).join(", ")} +${counties.length - 2}`}
          onClear={counties.length ? () => setCounties([]) : undefined}
        >
          {(close) => <CountyMultiSelect selected={counties} onChange={setCounties} counts={countyCounts} onDone={close} />}
        </FilterChip>
        <FilterChip label="Finanțare" value={fundingSource === "all" ? "toate" : fundingSource} width={300} onClear={fundingSource !== "all" ? () => setFundingSource("all") : undefined}>
          {(close) => (
            <div className="max-h-72 overflow-y-auto">
              <FilterOption active={fundingSource === "all"} onClick={pick(() => setFundingSource("all"), close)}>
                Toate sursele
              </FilterOption>
              {fundingSources.map((fs) => (
                <FilterOption key={fs} active={fundingSource === fs} onClick={pick(() => setFundingSource(fs), close)}>
                  {fs}
                </FilterOption>
              ))}
            </div>
          )}
        </FilterChip>
        <FilterChip label="Procedură" value={procedureType ? PROCEDURE_TYPE_LABELS[procedureType] ?? procedureType : "toate"} width={300} onClear={procedureType ? () => setProcedureType("") : undefined}>
          {(close) => (
            <>
              <FilterOption active={!procedureType} onClick={pick(() => setProcedureType(""), close)}>
                Toate
              </FilterOption>
              {Object.entries(PROCEDURE_TYPE_LABELS).map(([value, label]) => (
                <FilterOption key={value} active={procedureType === value} onClick={pick(() => setProcedureType(value), close)}>
                  {label}
                </FilterOption>
              ))}
            </>
          )}
        </FilterChip>
        <FilterChip
          label="CUI autoritate"
          value={authorityCui || "oricare"}
          width={280}
          onClear={
            authorityCui
              ? () => {
                  setCuiDraft("");
                  setAuthorityCui("");
                }
              : undefined
          }
        >
          {(close) => (
            <div className="p-1.5">
              <label className="mb-1.5 block text-[14px] font-medium" htmlFor="cui-filter">
                CUI-ul autorității contractante
              </label>
              <input
                id="cui-filter"
                value={cuiDraft}
                inputMode="numeric"
                placeholder="ex. 4540712"
                autoFocus
                onChange={(e) => setCuiDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    setAuthorityCui(cuiDraft.trim());
                    close();
                  }
                }}
                className="tabular h-10 w-full rounded-lg border border-line-input bg-paper px-3 text-[15px] text-ink outline-none focus:border-editorial"
              />
              <p className="mt-1.5 text-[13px] text-stock-400">Enter pentru a filtra. Prefixul „RO” e acceptat.</p>
            </div>
          )}
        </FilterChip>
        <FilterChip label="Ordonare" value={SORT_LABELS[sort].toLowerCase()} width={240} align="right">
          {(close) => (
            <>
              {(Object.keys(SORT_LABELS) as LeadSort[]).map((s) => (
                <FilterOption key={s} active={sort === s} onClick={pick(() => setSort(s), close)}>
                  {SORT_LABELS[s]}
                </FilterOption>
              ))}
            </>
          )}
        </FilterChip>
        {filtersActive && (
          <button type="button" onClick={resetFilters} className="min-h-9 rounded-lg px-3 text-[14px] font-medium text-accent hover:bg-surface-2">
            Resetează filtrele
          </button>
        )}
      </div>

      {(degraded || error || noMatchesForProfile) && (
        <div className="mb-5 flex flex-col gap-3">
          {degraded && <DegradedBanner />}
          {error && (
            <Notice tone="alert" title="Registrul nu a răspuns">
              {error}
            </Notice>
          )}
          {noMatchesForProfile && !error && (
            <Notice title="Niciun dosar nu corespunde criteriilor dvs.">
              Afișăm toată piața, ordonată după relevanță.{" "}
              <button type="button" onClick={() => setCriteriaOpen(true)} className="font-medium text-accent underline underline-offset-2">
                Ajustați criteriile
              </button>
            </Notice>
          )}
        </div>
      )}

      {loading ? (
        <Loading label="Se sincronizează registrul" />
      ) : (
        <LeadList
          leads={visibleLeads.slice(0, shown)}
          onOpen={setSelectedLead}
          selectedId={selectedLead?.source_id}
          empty={
            leads.length > 0 ? (
              <NoResultsRelaxationBanner title={relaxation.title} message="Filtrele exclud toate dosarele din registru." actionLabel={relaxation.label} onAction={relaxation.action} />
            ) : (
              <EmptyRegistryState onEditCriteria={() => setCriteriaOpen(true)} />
            )
          }
          footer={
            visibleLeads.length > 0 ? (
              <>
                <span className="tabular">
                  {formatNumber(Math.min(shown, visibleLeads.length))} din {formatNumber(visibleLeads.length)}
                </span>
                <span className="flex-1" />
                {shown < visibleLeads.length && (
                  <Button variant="outline" onClick={() => setShown((n) => n + PAGE)}>
                    Arată încă {formatNumber(Math.min(PAGE, visibleLeads.length - shown))}
                  </Button>
                )}
              </>
            ) : undefined
          }
        />
      )}

      {selectedLead && <LeadDossierPanel key={selectedLead.source_id} lead={selectedLead} onClose={closeDossier} />}
      <ProfileCriteriaModal isOpen={criteriaOpen} onClose={() => setCriteriaOpen(false)} />

      {toast && (
        <div role="status" aria-live="polite" className="fixed bottom-24 left-1/2 z-50 max-w-[calc(100%-2rem)] -translate-x-1/2 rounded-lg bg-cerneala px-4 py-2.5 text-[14px] text-cerneala-text shadow-float">
          {toast}
        </div>
      )}
    </main>
  );
}

export default function LicitatiiPage() {
  return (
    <AuthGate title="Licitații" description="Registrul complet, filtrele și dosarul fiecărei licitații.">
      <Suspense fallback={<Loading label="Se încarcă" />}>
        <LicitatiiContent />
      </Suspense>
    </AuthGate>
  );
}
