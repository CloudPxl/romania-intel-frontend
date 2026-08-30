"use client";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { X } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import AuthGate from "@/components/AuthGate";
import {
  ApiError,
  addLeadToPipeline,
  downloadTenantCsv,
  fetchTenantFeed,
  triggerEmailAlert,
  type Lead,
} from "@/lib/api";
import { CATEGORIES, categoryLabel, formatDate, formatRon } from "@/lib/format";
import {
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

function NewsletterContent() {
  const router = useRouter();
  const { user, preferences, activeDesk, activeTenantId } = useAuth();

  const [leads, setLeads] = useState<Lead[]>([]);
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [degraded, setDegraded] = useState<boolean>(false);
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);

  const [activeCategory, setActiveCategory] = useState<string>("all");
  const [selectedDivision, setSelectedDivision] = useState<string>("all");
  const [selectedCounty, setSelectedCounty] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState<SortId>("score_desc");
  const [filtersOpen, setFiltersOpen] = useState(false);

  const [toast, setToast] = useState<string | null>(null);
  const [busyAction, setBusyAction] = useState<string | null>(null);

  const loadWorkspace = useCallback(
    async (force = false) => {
      if (force) setRefreshing(true);
      else setLoading(true);
      setError(null);
      try {
        const feed = await fetchTenantFeed(activeTenantId, undefined, activeCategory, force);
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
    [activeTenantId, activeCategory]
  );

  useEffect(() => {
    loadWorkspace(false);
  }, [loadWorkspace]);

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

  const counties = useMemo(() => {
    const set = new Set<string>();
    leads.forEach((l) => l.county && set.add(l.county));
    return Array.from(set).sort((a, b) => a.localeCompare(b, "ro"));
  }, [leads]);

  const visibleLeads = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    const division = activeDesk?.divisions?.find((d) => d.id === selectedDivision);

    const filtered = leads.filter((l) => {
      if (selectedCounty !== "all" && (l.county || "").toLowerCase() !== selectedCounty.toLowerCase()) return false;
      if (query) {
        const haystack = [l.project_title, l.entity_name, l.locality, l.sub_category, l.county]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        if (!haystack.includes(query)) return false;
      }
      if (division?.keywords?.length) {
        const text = [l.project_title, l.executive_summary, l.sub_category].filter(Boolean).join(" ").toLowerCase();
        if (!division.keywords.some((k) => text.includes(k.toLowerCase()))) return false;
      }
      return true;
    });

    return filtered.sort((a, b) => {
      if (sortBy === "budget_desc") return (b.financial_value_ron || 0) - (a.financial_value_ron || 0);
      if (sortBy === "budget_asc") return (a.financial_value_ron || 0) - (b.financial_value_ron || 0);
      if (sortBy === "date_desc") return (b.published_date || "").localeCompare(a.published_date || "");
      return (b.opportunity_score || 0) - (a.opportunity_score || 0);
    });
  }, [leads, searchQuery, selectedCounty, selectedDivision, sortBy, activeDesk]);

  const totalValue = visibleLeads.reduce((sum, l) => sum + (l.financial_value_ron || 0), 0);

  const handleSaveToPipeline = async (lead: Lead) => {
    setBusyAction("pipeline");
    try {
      const res = await addLeadToPipeline(activeTenantId, lead);
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
      await downloadTenantCsv(activeTenantId);
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
        <Eyebrow className="mb-2 border-b border-ink pb-1.5">Domenii</Eyebrow>
        <div className="flex flex-col">
          {[{ id: "all", label: "Toate domeniile" }, ...CATEGORIES].map((c) => (
            <button
              key={c.id}
              onClick={() => setActiveCategory(c.id)}
              className={
                "min-h-[40px] border-b border-divider px-2 py-2 text-left font-body text-sm transition-colors " +
                (activeCategory === c.id ? "bg-ink text-paper" : "text-stock-600 hover:bg-stock-100")
              }
            >
              {c.label}
            </button>
          ))}
        </div>
      </div>

      {(activeDesk?.divisions?.length ?? 0) > 0 && (
        <div>
          <Eyebrow className="mb-2 border-b border-ink pb-1.5">Divizii desk</Eyebrow>
          <div className="flex flex-col">
            {[{ id: "all", name: "Toate liniile" }, ...(activeDesk?.divisions ?? [])].map((d) => (
              <button
                key={d.id}
                onClick={() => setSelectedDivision(d.id)}
                className={
                  "min-h-[40px] border-b border-divider px-2 py-2 text-left font-body text-sm transition-colors " +
                  (selectedDivision === d.id ? "bg-ink text-paper" : "text-stock-600 hover:bg-stock-100")
                }
              >
                {"name" in d ? d.name : ""}
              </button>
            ))}
          </div>
        </div>
      )}

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

      <div className="border border-ink p-4">
        <Eyebrow>Volum filtrat</Eyebrow>
        <p className="tabular font-display mt-1 text-3xl font-black leading-none">{formatRon(totalValue)}</p>
        <p className="font-mono mt-2 text-[11px] text-stock-500">
          {visibleLeads.length} din {leads.length} dosare
        </p>
      </div>
    </div>
  );

  return (
    <main className="mx-auto w-full max-w-screen-xl flex-1 px-4 py-6 sm:py-8">
      <header className="border-b-4 border-ink pb-5">
        <Eyebrow className="text-editorial">Registrul zilnic · {activeDesk?.name}</Eyebrow>
        <div className="mt-2 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h1 className="font-display text-4xl font-black leading-[0.95] tracking-tighter sm:text-6xl">
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
          <div className="mb-5 flex flex-col gap-3 border-y border-ink py-3 sm:flex-row sm:items-center">
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

          {loading ? (
            <Loading label="Se sincronizează registrul" />
          ) : visibleLeads.length === 0 ? (
            <EmptyState title="Niciun dosar pentru criteriile selectate">
              {leads.length > 0
                ? "Relaxați filtrele de domeniu, județ sau divizie pentru a vedea restul registrului."
                : "Registrul nu conține încă dosare potrivite pentru acest profil. Datele se actualizează la fiecare ciclu de scanare."}
            </EmptyState>
          ) : (
            <ul className="border-t border-ink">
              {visibleLeads.map((lead) => {
                const locked = Boolean(lead.is_locked);
                return (
                  <li key={lead.source_id} className="border-b border-ink">
                    <button
                      onClick={() => !locked && setSelectedLead(lead)}
                      disabled={locked}
                      className="flex w-full flex-col gap-3 p-4 text-left transition-colors hover:bg-stock-100 disabled:cursor-not-allowed sm:flex-row sm:gap-5 sm:p-5"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                          <span className="label-eyebrow text-editorial">{categoryLabel(lead.category)}</span>
                          {lead.sub_category && (
                            <span className="label-eyebrow text-stock-500">{lead.sub_category}</span>
                          )}
                          <span className="label-eyebrow text-stock-400">
                            {[lead.locality, lead.county].filter(Boolean).join(", ")}
                          </span>
                        </div>

                        <h2
                          className={
                            "font-display mt-2 text-xl font-bold leading-snug tracking-tight sm:text-2xl " +
                            (locked ? "blur-[3px] select-none" : "")
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
                              "font-body mt-2 line-clamp-2 text-sm leading-relaxed text-stock-700 " +
                              (locked ? "blur-[4px] select-none" : "")
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
                        <span className="tabular font-display text-xl font-black leading-none sm:text-right sm:text-2xl">
                          {formatRon(lead.financial_value_ron)}
                        </span>
                        {lead.opportunity_score != null && (
                          <span className="label-eyebrow whitespace-nowrap text-stock-600">
                            Scor {lead.opportunity_score}/10
                          </span>
                        )}
                        <span className="label-eyebrow whitespace-nowrap text-editorial">
                          {locked ? "Blocat" : "Deschide →"}
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
          <div className="absolute inset-0 bg-ink/50" onClick={() => setSelectedLead(null)} aria-hidden="true" />
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Dosar strategic"
            className="absolute inset-y-0 right-0 flex w-full max-w-xl flex-col overflow-y-auto border-l-4 border-ink bg-paper"
          >
            <div className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b-4 border-ink bg-paper p-4 sm:p-6">
              <div className="min-w-0">
                <Eyebrow className="text-editorial">Dosar strategic · {selectedLead.source_id}</Eyebrow>
                <h2 className="font-display mt-2 text-2xl font-black leading-tight tracking-tight">
                  {selectedLead.project_title}
                </h2>
                <p className="font-body mt-1 text-sm text-stock-600">
                  {selectedLead.entity_name} · {selectedLead.county}
                </p>
              </div>
              <button
                onClick={() => setSelectedLead(null)}
                aria-label="Închide dosarul"
                className="-mr-1 -mt-1 flex h-11 w-11 shrink-0 items-center justify-center border border-transparent transition-colors hover:border-ink"
              >
                <X size={20} strokeWidth={1.5} />
              </button>
            </div>

            <div className="flex-1 p-4 sm:p-6">
              <div className="grid grid-cols-2 border border-ink">
                <div className="border-r border-ink p-4">
                  <Eyebrow>Buget estimat</Eyebrow>
                  <p className="tabular font-display mt-1 text-2xl font-black leading-none">
                    {formatRon(selectedLead.financial_value_ron)}
                  </p>
                </div>
                <div className="p-4">
                  <Eyebrow>Sursă finanțare</Eyebrow>
                  <p className="font-display mt-1 text-lg font-bold leading-tight">
                    {selectedLead.funding_source || "Nespecificat"}
                  </p>
                </div>
              </div>

              <table className="mt-5 w-full border-collapse border border-ink text-left font-mono text-xs">
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

              {selectedLead.sales_pitch_angle && (
                <div className="mt-5 border-l-4 border-editorial px-4 py-3">
                  <Eyebrow className="text-editorial">Poziționare tehnică</Eyebrow>
                  <p className="font-body mt-1.5 text-sm leading-relaxed">{selectedLead.sales_pitch_angle}</p>
                </div>
              )}

              {selectedLead.executive_summary && (
                <div className="mt-5">
                  <Eyebrow className="border-b border-ink pb-1.5">Sinteză</Eyebrow>
                  <p className="font-body mt-2 text-sm leading-relaxed text-stock-700">
                    {selectedLead.executive_summary}
                  </p>
                </div>
              )}

              <div className="mt-6">
                <Eyebrow className="mb-3 border-b border-ink pb-1.5">Acțiuni</Eyebrow>
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
                  className="mt-6 flex min-h-[44px] w-full items-center justify-center border border-ink bg-ink px-4 font-sans text-xs font-semibold uppercase tracking-widest text-paper transition-colors hover:bg-paper hover:text-ink"
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
          className="fixed inset-x-4 bottom-4 z-50 border-2 border-ink bg-paper px-4 py-3 font-body text-sm shadow-[4px_4px_0_0_var(--color-ink)] sm:left-auto sm:right-6 sm:max-w-sm"
        >
          {toast}
        </div>
      )}
    </main>
  );
}

export default function NewsletterPage() {
  return (
    <AuthGate
      title="Registrul este pentru abonați"
      description="Fluxul de oportunități pre-SEAP și dosarele strategice sunt disponibile doar conturilor autentificate."
    >
      <NewsletterContent />
    </AuthGate>
  );
}
