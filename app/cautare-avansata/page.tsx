"use client";
import React, { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { X } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import AuthGate from "@/components/AuthGate";
import {
  ApiError,
  addLeadToPipeline,
  downloadMyCsv,
  fetchMyFeed,
  triggerEmailAlert,
  type Lead,
} from "@/lib/api";
import { CATEGORIES, categoryLabel, formatDate, formatLeadValue, formatRon } from "@/lib/format";
import {
  Badge,
  Button,
  DegradedBanner,
  EmptyState,
  Eyebrow,
  Field,
  Input,
  Loading,
  Notice,
  Select,
} from "@/components/newsprint";

const SORTS = [
  { id: "score_desc", label: "Scor oportunitate" },
  { id: "budget_desc", label: "Buget descrescător" },
  { id: "budget_asc", label: "Buget crescător" },
  { id: "date_desc", label: "Cele mai recente" },
] as const;

type SortId = (typeof SORTS)[number]["id"];

function CautareAvansataContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, preferences, profile } = useAuth();

  const [leads, setLeads] = useState<Lead[]>([]);
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [degraded, setDegraded] = useState<boolean>(false);
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);

  // A click-through from Analiza de Piață or Prima Pagina arrives with one
  // of these set — a deliberate choice to see a specific slice, not the
  // page's own default. Read once, via lazy initializers, rather than in
  // an effect: that avoids a second fetch firing right after the first.
  const initialCounty = searchParams.get("county") || "all";
  const initialCategory = searchParams.get("category") || "all";
  const initialFundingSource = searchParams.get("fundingSource") || "all";
  const initialOpenLead = searchParams.get("openLead");
  const arrivedWithUrlFilter = initialCounty !== "all" || initialCategory !== "all" || initialFundingSource !== "all";
  // `?matches=1` states explicitly which side of the soft filter the link
  // meant, instead of leaving it to the heuristic below. Prima Pagina's KPI
  // tiles count the signed-in user's OWN matches, so "Brașov · 145 mil RON"
  // has to land on the user's matches in Brașov — landing on the whole
  // Brașov market would show a different, larger set than the number the
  // user just clicked, which is worse than not linking at all.
  const initialMatchesParam = searchParams.get("matches");
  const initialSort = searchParams.get("sort");

  const [activeCategory, setActiveCategory] = useState<string>(initialCategory);
  // The feed now returns the WHOLE market ranked, not just matches, so
  // this toggle is what lets someone go back to just their own.
  // Start on the user's own matches, not the whole market. The feed is a
  // soft filter server-side — it ranks everything and hides nothing — but
  // landing on all 500 rows made the criteria someone just entered at
  // onboarding look like they had been ignored. `matchDefaultApplied`
  // makes this a one-time decision per load: once the user touches the
  // toggle, their choice stands and is never overridden by a refresh.
  //
  // Arriving via a specific county/category/funding-source link is its own
  // deliberate choice — the visitor clicked "Hunedoara" to see everything
  // in Hunedoara, not their own matches narrowed further by county — so it
  // starts on the full market (onlyMatches false) and is marked as already
  // decided, so the no-matches fallback effect below never re-litigates it.
  // An explicit ?matches= wins over both the default and the arrived-with-
  // a-filter rule, since it is the link stating what it meant.
  const [onlyMatches, setOnlyMatches] = useState(
    initialMatchesParam !== null ? initialMatchesParam === "1" : !arrivedWithUrlFilter
  );
  const [matchDefaultApplied, setMatchDefaultApplied] = useState(
    arrivedWithUrlFilter || initialMatchesParam !== null
  );
  const [selectedCounty, setSelectedCounty] = useState(initialCounty);
  const [selectedFundingSource, setSelectedFundingSource] = useState(initialFundingSource);
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState<SortId>(
    SORTS.some((s) => s.id === initialSort) ? (initialSort as SortId) : "score_desc"
  );
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [openLeadHandled, setOpenLeadHandled] = useState(!initialOpenLead);

  const [toast, setToast] = useState<string | null>(null);
  const [busyAction, setBusyAction] = useState<string | null>(null);

  const loadWorkspace = useCallback(
    async (force = false) => {
      if (force) setRefreshing(true);
      else setLoading(true);
      setError(null);
      try {
        const feed = await fetchMyFeed(activeCategory, force);
        setLeads(feed.leads || []);
        setDegraded(Boolean(feed.degraded));
        setUpdatedAt(feed.data_updated_at);
      } catch (e) {
        // A failed load used to be swallowed into console.warn, leaving the
        // page on a permanent "no signals" state that looked like a real
        // (empty) market rather than a broken request.
        setError(e instanceof ApiError ? e.detail : "Nu s-a putut încărca registrul.");
        setLeads([]);
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [activeCategory]
  );

  useEffect(() => {
    loadWorkspace(false);
  }, [loadWorkspace]);

  // The one case where defaulting to "my matches" would backfire: a
  // profile that currently matches nothing would open on an empty page,
  // which reads as a broken product rather than as a narrow filter. Fall
  // back to the full market and say why. Runs once per mount, so it
  // cannot fight the user after they set the toggle themselves.
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

  useEffect(() => {
    if (!selectedLead) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setSelectedLead(null);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selectedLead]);

  // A click-through from a top-opportunity row (Analiza de Piață / Prima
  // Pagina) names one specific lead by id rather than a filter — open its
  // dossier directly once the feed has actually loaded, instead of making
  // the visitor find it again in a list.
  useEffect(() => {
    if (openLeadHandled || loading || leads.length === 0) return;
    const found = leads.find((l) => l.source_id === initialOpenLead);
    if (found) setSelectedLead(found);
    setOpenLeadHandled(true);
  }, [openLeadHandled, loading, leads, initialOpenLead]);

  const counties = useMemo(() => {
    const set = new Set<string>();
    leads.forEach((l) => l.county && set.add(l.county));
    return Array.from(set).sort((a, b) => a.localeCompare(b, "ro"));
  }, [leads]);

  const fundingSources = useMemo(() => {
    const set = new Set<string>();
    leads.forEach((l) => l.funding_source && set.add(l.funding_source));
    return Array.from(set).sort((a, b) => a.localeCompare(b, "ro"));
  }, [leads]);

  const visibleLeads = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();

    const filtered = leads.filter((l) => {
      if (onlyMatches && !l.match?.is_match) return false;
      if (selectedCounty !== "all" && (l.county || "").toLowerCase() !== selectedCounty.toLowerCase()) return false;
      if (
        selectedFundingSource !== "all" &&
        (l.funding_source || "").toLowerCase() !== selectedFundingSource.toLowerCase()
      )
        return false;
      if (query) {
        const haystack = [l.project_title, l.entity_name, l.locality, l.sub_category, l.county]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        if (!haystack.includes(query)) return false;
      }
      return true;
    });

    return filtered.sort((a, b) => {
      if (sortBy === "budget_desc") return (b.financial_value_ron || 0) - (a.financial_value_ron || 0);
      if (sortBy === "budget_asc") return (a.financial_value_ron || 0) - (b.financial_value_ron || 0);
      if (sortBy === "date_desc") return (b.published_date || "").localeCompare(a.published_date || "");
      // Default: leave the server's relevance order alone. Re-sorting by
      // opportunity_score here would discard the ranking the whole feed
      // was just built around.
      return 0;
    });
  }, [leads, searchQuery, selectedCounty, selectedFundingSource, onlyMatches, sortBy]);

  const totalValue = visibleLeads.reduce((sum, l) => sum + (l.financial_value_ron || 0), 0);

  const noMatchesForProfile =
    leads.length > 0 && !leads.some((l) => l.match?.is_match);

  const handleSaveToPipeline = async (lead: Lead) => {
    setBusyAction("pipeline");
    try {
      const res = await addLeadToPipeline(lead);
      setToast(res.status === "success" ? "Dosar salvat în pipeline." : res.message || "Nu s-a putut salva dosarul.");
    } catch (e) {
      setToast(e instanceof ApiError ? e.detail : "Nu s-a putut salva dosarul.");
    } finally {
      setBusyAction(null);
    }
  };

  const handleSendEmailAlert = async (lead: Lead) => {
    const recipient = preferences?.notification_email || user?.email;
    if (!recipient) {
      setToast("Configurați un email de notificare în Setări cont.");
      return;
    }
    setBusyAction("email");
    try {
      const res = await triggerEmailAlert(lead, recipient);
      setToast(
        res.status === "success"
          ? `Alertă expediată către ${recipient}.`
          : "Serverul nu are configurat un canal SMTP — alerta nu a fost trimisă."
      );
    } catch (e) {
      setToast(e instanceof ApiError ? e.detail : "Nu s-a putut expedia alerta.");
    } finally {
      setBusyAction(null);
    }
  };

  const handleExport = async () => {
    setBusyAction("csv");
    try {
      await downloadMyCsv();
    } catch (e) {
      setToast(e instanceof ApiError ? e.detail : "Exportul CSV a eșuat.");
    } finally {
      setBusyAction(null);
    }
  };

  const openTool = (path: string, params: Record<string, string>) => {
    router.push(`${path}?${new URLSearchParams(params).toString()}`);
  };

  const filterPanel = (
    <div className="space-y-6">
      <div>
        <Eyebrow className="mb-2">Domenii</Eyebrow>
        <div className="flex flex-col gap-0.5">
          {[{ id: "all", label: "Toate domeniile" }, ...CATEGORIES].map((c) => (
            <button
              key={c.id}
              onClick={() => setActiveCategory(c.id)}
              className={
                "min-h-[40px] rounded-lg px-2.5 py-2 text-left font-body text-sm transition-colors " +
                (activeCategory === c.id ? "neu-pressed-sm bg-editorial-soft font-medium text-editorial" : "text-stock-600 hover:neu-flat-sm")
              }
            >
              {c.label}
            </button>
          ))}
        </div>
      </div>

      <div>
        <Eyebrow className="mb-2">Relevanță</Eyebrow>
        <div className="flex flex-col gap-0.5">
          {[
            { id: false, label: "Toată piața" },
            { id: true, label: "Doar potrivirile mele" },
          ].map((opt) => (
            <button
              key={String(opt.id)}
              onClick={() => {
                // Claim the decision, so a still-loading feed cannot
                // flip the toggle back underneath the user.
                setMatchDefaultApplied(true);
                setOnlyMatches(opt.id);
              }}
              className={
                "min-h-[40px] rounded-lg px-2.5 py-2 text-left font-body text-sm transition-colors " +
                (onlyMatches === opt.id
                  ? "neu-pressed-sm bg-editorial-soft font-medium text-editorial"
                  : "text-stock-600 hover:neu-flat-sm")
              }
            >
              {opt.label}
            </button>
          ))}
        </div>
        <p className="font-body mt-2 px-2.5 text-[11px] leading-snug text-stock-500">
          {onlyMatches
            ? "Vedeți dosarele care corespund criteriilor dvs. Comutați pe „Toată piața” pentru restul licitațiilor, ordonate după relevanță."
            : "Vedeți toată piața, ordonată după potrivirea cu criteriile dvs. Dosarele potrivite sunt marcate."}
        </p>
      </div>

      <Field label="Județ">
        <Select value={selectedCounty} onChange={(e) => setSelectedCounty(e.target.value)}>
          <option value="all">Toate județele ({counties.length})</option>
          {counties.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </Select>
      </Field>

      <Field label="Sursă finanțare">
        <Select value={selectedFundingSource} onChange={(e) => setSelectedFundingSource(e.target.value)}>
          <option value="all">Toate sursele ({fundingSources.length})</option>
          {fundingSources.map((fs) => (
            <option key={fs} value={fs}>
              {fs}
            </option>
          ))}
        </Select>
      </Field>

      <div className="neu-flat rounded-2xl bg-paper p-4">
        <Eyebrow>Volum filtrat</Eyebrow>
        <p className="tabular font-display mt-1 text-2xl font-semibold leading-none">{formatRon(totalValue)}</p>
        <p className="font-mono mt-2 text-[11px] text-stock-500">
          {visibleLeads.length} din {leads.length} dosare
        </p>
      </div>
    </div>
  );

  return (
    <main className="mx-auto w-full max-w-screen-xl flex-1 px-4 py-6 sm:py-8">
      <header className="border-b border-divider pb-6">
        <Eyebrow className="text-editorial">Căutare avansată · {profile?.display_name ?? ""}</Eyebrow>
        <div className="mt-2 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h1 className="font-display text-3xl font-semibold leading-tight tracking-tight sm:text-4xl">
              Oportunități pre-SEAP
            </h1>
            <p className="font-mono mt-2 text-[11px] uppercase tracking-[0.18em] text-stock-500">
              Ultima sincronizare: {formatDate(updatedAt)}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => loadWorkspace(true)} disabled={refreshing}>
              {refreshing ? "Se actualizează…" : "Actualizează"}
            </Button>
            <Button variant="outline" onClick={handleExport} disabled={busyAction === "csv"}>
              {busyAction === "csv" ? "Se exportă…" : "Export CSV"}
            </Button>
            <Button
              variant="ghost"
              className="lg:hidden"
              onClick={() => setFiltersOpen((v) => !v)}
              aria-expanded={filtersOpen}
            >
              {filtersOpen ? "Ascunde filtre" : "Filtre"}
            </Button>
          </div>
        </div>
      </header>

      {degraded && (
        <div className="mt-5">
          <DegradedBanner />
        </div>
      )}

      <div className="mt-6 grid grid-cols-1 gap-8 lg:grid-cols-12">
        {/* Filters */}
        <aside className={"lg:col-span-3 " + (filtersOpen ? "block" : "hidden lg:block")}>{filterPanel}</aside>

        {/* Feed */}
        <section className="lg:col-span-9">
          <div className="mb-5 flex flex-col gap-3 border-y border-divider py-3 sm:flex-row sm:items-center">
            <Input
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Caută proiect, autoritate, localitate…"
              aria-label="Caută în registru"
              className="sm:flex-1"
            />
            <Select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as SortId)}
              aria-label="Sortare"
              className="sm:w-64"
            >
              {SORTS.map((s) => (
                <option key={s.id} value={s.id}>
                  Sortare: {s.label}
                </option>
              ))}
            </Select>
          </div>

          {error && (
            <div className="mb-5">
              <Notice tone="alert" title="Eroare la încărcare">
                {error}
              </Notice>
            </div>
          )}

          {/* The criteria are being honoured and still matched nothing —
              say so, otherwise falling back to the whole market looks
              like the filter silently failing. */}
          {!loading && !error && noMatchesForProfile && (
            <div className="mb-5">
              <Notice tone="neutral" title="Niciun dosar nu corespunde criteriilor dvs.">
                Afișăm toată piața, ordonată după relevanță. Ajustați
                cuvintele-cheie, județele sau valoarea minimă din setările
                profilului pentru a primi potriviri.
              </Notice>
            </div>
          )}

          {loading ? (
            <Loading label="Se sincronizează registrul" />
          ) : visibleLeads.length === 0 ? (
            <EmptyState title="Niciun dosar pentru criteriile selectate">
              {leads.length > 0
                ? "Relaxați filtrele de domeniu, județ sau divizie pentru a vedea restul registrului."
                : "Registrul nu conține încă dosare potrivite pentru acest profil. Datele se actualizează la fiecare ciclu de scanare."}
            </EmptyState>
          ) : (
            <ul className="divide-y divide-divider neu-flat overflow-hidden rounded-3xl bg-paper">
              {visibleLeads.map((lead) => {
                const matched = Boolean(lead.match?.is_match);
                return (
                  <li key={lead.source_id}>
                    <button
                      onClick={() => setSelectedLead(lead)}
                      className={
                        "flex w-full flex-col gap-3 p-4 text-left transition-all duration-300 hover:neu-pressed-sm sm:flex-row sm:gap-5 sm:p-5 " +
                        // A matched row gets a left rail in the accent
                        // colour. Deliberately not a filled background: in
                        // this design depth is shadow, and a tinted row
                        // would read as a different material.
                        (matched ? "border-l-[3px] border-editorial" : "border-l-[3px] border-transparent")
                      }
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                          <span className="label-eyebrow text-editorial">{categoryLabel(lead.category)}</span>
                          {matched && (
                            <Badge tone="accent">
                              {/* Names WHY it matched, so the ranking is
                                  explainable rather than magic. */}
                              Potrivire · {lead.match?.reasons.join(", ")}
                            </Badge>
                          )}
                          {lead.metadata?.seap_cross_reference && (
                            // Deliberately a different tone than the match
                            // badge above — this is a best-effort heuristic
                            // (find_seap_cross_reference needs 2 of 3
                            // signals to agree), never a verified identity,
                            // so it must not read as the same kind of claim.
                            <Badge tone="neutral">Potrivire SEAP: posibilă</Badge>
                          )}
                          {lead.sub_category && (
                            <span className="label-eyebrow text-stock-500">{lead.sub_category}</span>
                          )}
                          <span className="label-eyebrow text-stock-400">
                            {[lead.locality, lead.county].filter(Boolean).join(", ")}
                          </span>
                        </div>

                        <h2
                          className={
                            "font-display mt-2 text-xl font-bold leading-snug tracking-tight sm:text-2xl"
                          }
                        >
                          {lead.project_title}
                        </h2>

                        <p className="font-body mt-1 text-sm text-stock-600">
                          {lead.entity_name}
                          {lead.source_type && <span className="text-stock-400"> · {lead.source_type}</span>}
                        </p>

                        {lead.executive_summary && (
                          <p
                            className={
                              "font-body mt-2 line-clamp-2 text-sm leading-relaxed text-stock-700"
                            }
                          >
                            {lead.executive_summary}
                          </p>
                        )}

                        <div className="font-mono mt-3 flex flex-wrap gap-x-4 gap-y-1 text-[11px] uppercase tracking-wider text-stock-500">
                          <span>Publicat: {formatDate(lead.published_date)}</span>
                          {lead.action_deadline && <span>Termen: {lead.action_deadline}</span>}
                        </div>
                      </div>

                      <div className="flex shrink-0 items-center justify-between gap-4 border-t border-divider pt-3 sm:w-40 sm:flex-col sm:items-end sm:justify-start sm:border-l sm:border-t-0 sm:pl-5 sm:pt-0">
                        {lead.financial_value_ron ? (
                          <span className="tabular font-display text-xl font-semibold leading-none sm:text-right sm:text-2xl">
                            {formatRon(lead.financial_value_ron)}
                          </span>
                        ) : (
                          // A missing budget is absent data, not a large
                          // number — it gets the muted italic treatment a
                          // blank field takes elsewhere, not bold display
                          // type sized for a real currency figure.
                          <span className="font-body text-sm italic text-stock-400 sm:text-right">
                            {formatLeadValue(lead.financial_value_ron)}
                          </span>
                        )}
                        {lead.opportunity_score != null && (
                          <span className="label-eyebrow whitespace-nowrap text-stock-600">
                            Scor {lead.opportunity_score}/10
                          </span>
                        )}
                        <span className="label-eyebrow whitespace-nowrap text-editorial">
                          Deschide →
                        </span>
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>

      {/* Dossier drawer */}
      {selectedLead && (
        <div className="fixed inset-0 z-50">
          <div className="absolute inset-0 bg-black/60" onClick={() => setSelectedLead(null)} aria-hidden="true" />
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Dosar strategic"
            className="absolute inset-y-0 right-0 flex w-full max-w-xl flex-col overflow-y-auto bg-paper"
          >
            <div className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-divider bg-paper/95 p-4 backdrop-blur sm:p-6">
              <div className="min-w-0">
                <Eyebrow className="text-editorial">Dosar strategic · {selectedLead.source_id}</Eyebrow>
                <h2 className="font-display mt-2 text-xl font-semibold leading-tight tracking-tight sm:text-2xl">
                  {selectedLead.project_title}
                </h2>
                <p className="font-body mt-1 text-sm text-stock-600">
                  {selectedLead.entity_name} · {selectedLead.county}
                </p>
              </div>
              <button
                onClick={() => setSelectedLead(null)}
                aria-label="Închide dosarul"
                className="-mr-1 -mt-1 flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-stock-500 transition-all duration-300 hover:neu-pressed-sm hover:text-ink"
              >
                <X size={20} strokeWidth={1.5} />
              </button>
            </div>

            <div className="flex-1 p-4 sm:p-6">
              <div className="grid grid-cols-2 divide-x divide-divider neu-pressed overflow-hidden rounded-2xl bg-paper">
                <div className="p-4">
                  <Eyebrow>Buget estimat</Eyebrow>
                  <p
                    className={
                      "mt-1 leading-snug " +
                      (selectedLead.financial_value_ron
                        ? "tabular font-display text-xl font-semibold leading-none"
                        : "font-body text-sm italic text-stock-400")
                    }
                  >
                    {formatLeadValue(selectedLead.financial_value_ron)}
                  </p>
                </div>
                <div className="p-4">
                  <Eyebrow>Sursă finanțare</Eyebrow>
                  <p className="font-display mt-1 text-base font-semibold leading-tight">
                    {selectedLead.funding_source || "Nespecificat"}
                  </p>
                </div>
              </div>

              <table className="mt-5 w-full neu-pressed overflow-hidden rounded-2xl bg-paper text-left font-mono text-xs">
                <tbody>
                  {[
                    ["Data publicării", formatDate(selectedLead.published_date)],
                    ["Termen dialog tehnic", selectedLead.action_deadline || "Nespecificat"],
                    ["Registru sursă", selectedLead.source_type || "—"],
                    ["Scor oportunitate", selectedLead.opportunity_score != null ? `${selectedLead.opportunity_score} / 10` : "—"],
                  ].map(([label, value]) => (
                    <tr key={label} className="border-b border-divider last:border-b-0">
                      <th
                        scope="row"
                        className="w-44 border-r border-divider px-3 py-2.5 font-sans text-[10px] font-semibold uppercase tracking-widest text-stock-500"
                      >
                        {label}
                      </th>
                      <td className="px-3 py-2.5">{value}</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {selectedLead.metadata?.seap_cross_reference && (
                <p className="font-mono mt-2 text-[11px] uppercase tracking-widest text-stock-500">
                  Posibilă corespondență SEAP · bază:{" "}
                  {selectedLead.metadata.seap_cross_reference.basis
                    .map(
                      (b) =>
                        ({ cpv_prefix: "CPV", value_within_tolerance: "valoare", buyer_name: "autoritate" }[b])
                    )
                    .join(", ")}
                </p>
              )}

              {selectedLead.sales_pitch_angle && (
                <div className="neu-pressed mt-5 rounded-r-lg border-l-2 border-editorial bg-editorial-soft px-4 py-3">
                  <Eyebrow className="text-editorial">Poziționare tehnică</Eyebrow>
                  <p className="font-body mt-1.5 text-sm leading-relaxed">{selectedLead.sales_pitch_angle}</p>
                </div>
              )}

              {selectedLead.executive_summary && (
                <div className="mt-5">
                  <Eyebrow className="mb-1.5">Sinteză</Eyebrow>
                  <p className="font-body mt-2 text-sm leading-relaxed text-stock-600">
                    {selectedLead.executive_summary}
                  </p>
                </div>
              )}

              <div className="mt-6">
                <Eyebrow className="mb-3">Acțiuni</Eyebrow>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  <Button onClick={() => handleSaveToPipeline(selectedLead)} disabled={busyAction === "pipeline"}>
                    {busyAction === "pipeline" ? "Se salvează…" : "Salvează în pipeline"}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => handleSendEmailAlert(selectedLead)}
                    disabled={busyAction === "email"}
                  >
                    {busyAction === "email" ? "Se expediază…" : "Trimite alertă email"}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() =>
                      openTool("/drafting", {
                        tool: "proposal",
                        project_title: selectedLead.project_title || "",
                        authority_name: selectedLead.entity_name || "",
                        county: selectedLead.county || "",
                        category: selectedLead.category || "",
                        source_id: selectedLead.source_id || "",
                        budget: String(selectedLead.financial_value_ron || ""),
                      })
                    }
                  >
                    Propunere tehnică
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() =>
                      openTool("/drafting", {
                        tool: "clarification",
                        project_title: selectedLead.project_title || "",
                        authority_name: selectedLead.entity_name || "",
                        source_id: selectedLead.source_id || "",
                      })
                    }
                  >
                    Solicitare clarificări
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() =>
                      openTool("/analytics", {
                        tool: "competitor",
                        category: selectedLead.category || "",
                        county: selectedLead.county || "",
                        budget: String(selectedLead.financial_value_ron || ""),
                      })
                    }
                  >
                    Profil de piață
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() =>
                      openTool("/analytics", {
                        tool: "win",
                        budget: String(selectedLead.financial_value_ron || ""),
                        project_title: selectedLead.project_title || "",
                      })
                    }
                  >
                    Poziționare preț
                  </Button>
                </div>
              </div>

              {selectedLead.source_url && (
                <a
                  href={selectedLead.source_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-6 flex min-h-[44px] w-full items-center justify-center rounded-lg bg-editorial px-4 font-sans text-sm font-medium text-white transition-colors hover:brightness-110"
                >
                  Documentul oficial sursă →
                </a>
              )}
            </div>
          </div>
        </div>
      )}

      {toast && (
        <div
          role="status"
          aria-live="polite"
          className="neu-flat fixed inset-x-4 bottom-4 z-50 rounded-2xl bg-paper px-4 py-3 font-body text-sm text-ink sm:left-auto sm:right-6 sm:max-w-sm"
        >
          {toast}
        </div>
      )}
    </main>
  );
}

export default function CautareAvansataPage() {
  return (
    <AuthGate
      title="Căutarea avansată este pentru abonați"
      description="Fluxul de oportunități pre-SEAP și dosarele strategice sunt disponibile doar conturilor autentificate."
    >
      <Suspense fallback={<Loading label="Se încarcă…" />}>
        <CautareAvansataContent />
      </Suspense>
    </AuthGate>
  );
}
