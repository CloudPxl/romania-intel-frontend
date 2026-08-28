"use client";
import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { fetchTenantFeed, addLeadToPipeline, triggerEmailAlert } from "@/lib/api";

export default function NewsletterPage() {
  const router = useRouter();
  const { user, preferences, activeDesk } = useAuth();
  const [selectedDivision, setSelectedDivision] = useState<string>("all");
  const [activeCategory, setActiveCategory] = useState<string>("all");
  const [leads, setLeads] = useState<any[]>([]);
  const [selectedLead, setSelectedLead] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedCounty, setSelectedCounty] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState<string>("score_desc");
  const [emailSending, setEmailSending] = useState(false);
  const [emailSentSuccess, setEmailSentSuccess] = useState(false);

  const loadWorkspace = async (force = false) => {
    if (force) setRefreshing(true);
    else setLoading(true);

    try {
      const feedData = await fetchTenantFeed(activeDesk?.id || "desk_default", undefined, activeCategory, force);
      setLeads(feedData?.leads || []);
    } catch (err) {
      console.warn("[Newsletter] Load note:", err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadWorkspace(false);
  }, [activeDesk?.id, activeCategory]);

  const handleSaveToPipeline = async (lead: any) => {
    try {
      await addLeadToPipeline(activeDesk?.id || "desk_default", lead);
      alert("Dosarul a fost salvat in Pipeline.");
    } catch {
      alert("Eroare la salvarea in pipeline.");
    }
  };

  const handleSendEmailAlert = async (lead: any) => {
    setEmailSending(true);
    setEmailSentSuccess(false);
    try {
      const recipient = preferences?.notification_email || user?.email || "director@infraconstruct.ro";
      await triggerEmailAlert(lead, recipient);
      setEmailSentSuccess(true);
      setTimeout(() => setEmailSentSuccess(false), 4000);
    } catch {
      alert("Eroare la transmiterea alertei pe email.");
    } finally {
      setEmailSending(false);
    }
  };

  const openDraftingTool = (kind: "proposal" | "clarification", lead: any) => {
    const params = new URLSearchParams({
      tool: kind,
      project_title: lead?.project_title || "",
      authority_name: lead?.entity_name || "",
      county: lead?.county || "",
      category: lead?.category || "",
      source_id: lead?.source_id || "",
    });
    router.push(`/drafting?${params.toString()}`);
  };

  const openAnalyticsTool = (kind: "competitor" | "caiet" | "win", lead: any) => {
    const params = new URLSearchParams({
      tool: kind,
      category: lead?.category || "",
      county: lead?.county || "",
      budget: String(lead?.financial_value_ron || ""),
      project_title: lead?.project_title || "",
    });
    router.push(`/analytics?${params.toString()}`);
  };

  const filteredLeads = leads.filter((l) => {
    const matchCounty = selectedCounty === "all" || l?.county?.toLowerCase() === selectedCounty.toLowerCase();
    const matchSearch =
      !searchQuery ||
      l?.project_title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      l?.entity_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      l?.locality?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      l?.sub_category?.toLowerCase().includes(searchQuery.toLowerCase());

    let matchDivision = true;
    if (selectedDivision !== "all" && activeDesk?.divisions) {
      const activeDiv = activeDesk.divisions.find(d => d.id === selectedDivision);
      if (activeDiv && activeDiv.keywords?.length > 0) {
        const text = (l?.project_title + " " + l?.executive_summary + " " + l?.sub_category).toLowerCase();
        matchDivision = activeDiv.keywords.some(k => text.includes(k.toLowerCase()));
      }
    }

    return matchCounty && matchSearch && matchDivision;
  });

  filteredLeads.sort((a, b) => {
    if (sortBy === "budget_desc") return (b.financial_value_ron || 0) - (a.financial_value_ron || 0);
    if (sortBy === "budget_asc") return (a.financial_value_ron || 0) - (b.financial_value_ron || 0);
    if (sortBy === "date_desc") return (b.published_date || "").localeCompare(a.published_date || "");
    return (b.opportunity_score || 0) - (a.opportunity_score || 0);
  });

  const totalPipeline = filteredLeads.reduce((acc, curr) => acc + (curr?.financial_value_ron || 0), 0);
  const isSubscriber = Boolean(user?.is_subscribed);

  return (
    <div className="flex-1 flex overflow-hidden">
      {/* SIDEBAR */}
      <aside className="w-72 border-r border-slate-200 bg-white p-5 flex flex-col justify-between hidden md:flex">
        <div>
          <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block mb-3">Domenii Strategice</span>
          <div className="space-y-1 mb-5 text-xs">
            {[
              { id: "all", label: "Toate Categoriile (Complet)" },
              { id: "infrastructura", label: "Infrastructura & Transporturi" },
              { id: "sanatate", label: "Sanatate & Echipamente Medicale" },
              { id: "energie", label: "Energie & Utilitati Verzi" },
              { id: "aparare", label: "Aparare & Securitate Speciala" },
              { id: "digitalizare", label: "Digitalizare, IT & Smart City" }
            ].map((c) => (
              <button
                key={c.id}
                onClick={() => setActiveCategory(c.id)}
                className={"w-full text-left rounded-lg px-3 py-2 font-medium transition " + (activeCategory === c.id ? "bg-brand-50 text-brand-800 border border-brand-200 font-bold" : "text-slate-600 hover:bg-slate-50 hover:text-slate-900")}
              >
                {c.label}
              </button>
            ))}
          </div>

          <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block mb-2">Divizii Desk ({activeDesk?.name ? activeDesk.name.split(" ")[0] : ""})</span>
          <div className="space-y-1 mb-5">
            <button
              onClick={() => setSelectedDivision("all")}
              className={"w-full text-left rounded-lg px-3 py-1.5 text-xs transition " + (selectedDivision === "all" ? "text-brand-700 font-bold" : "text-slate-600 hover:bg-slate-50")}
            >
              Toate Liniile Desk
            </button>
            {activeDesk?.divisions?.map((d) => (
              <button
                key={d.id}
                onClick={() => setSelectedDivision(d.id)}
                className={"w-full text-left rounded-lg px-3 py-1.5 text-xs transition " + (selectedDivision === d.id ? "text-brand-700 font-bold" : "text-slate-600 hover:bg-slate-50")}
              >
                {d.name}
              </button>
            ))}
          </div>

          <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block mb-2">Filtrare Judet</span>
          <select
            value={selectedCounty}
            onChange={(e) => setSelectedCounty(e.target.value)}
            className="w-full rounded-lg border border-slate-300 bg-slate-50 p-2 text-xs text-slate-800 focus:bg-white focus:outline-none focus:border-brand-500"
          >
            <option value="all">Toate Judetele Monitorizate (8)</option>
            <option value="Iasi">Iasi</option>
            <option value="Cluj">Cluj</option>
            <option value="Timis">Timis</option>
            <option value="Bucuresti">Bucuresti</option>
            <option value="Brasov">Brasov</option>
            <option value="Constanta">Constanta</option>
            <option value="Bihor">Bihor</option>
          </select>
        </div>

        <div className="rounded-xl border border-slate-200 bg-slate-50 p-3.5 text-xs text-slate-600 shadow-sm">
          <span className="block text-[10px] uppercase font-bold text-slate-500">Volum Total Identificat</span>
          <span className="text-xl font-extrabold text-slate-900 mt-0.5 block">{(totalPipeline / 1000000).toFixed(1)} Mil. RON</span>
          <span className="text-[11px] text-emerald-700 font-medium block mt-1">25 Motoare de Monitorizare Active</span>
        </div>
      </aside>

      {/* MAIN FEED */}
      <main className="flex-1 p-6 overflow-y-auto">
        <div className="flex flex-col lg:flex-row gap-3 justify-between items-center mb-6 bg-white p-3.5 rounded-xl border border-slate-200 shadow-sm">
          <div className="flex-1 w-full lg:w-auto flex items-center gap-2">
            <input
              type="text"
              placeholder="Cautare dupa proiect, autoritate, subcategorie sau cod..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full md:w-96 rounded-lg border border-slate-300 bg-slate-50 px-3 py-1.5 text-xs text-slate-900 placeholder-slate-400 focus:bg-white focus:border-brand-600 focus:outline-none"
            />
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="rounded-lg border border-slate-300 bg-slate-50 px-2.5 py-1.5 text-xs text-slate-700 focus:bg-white focus:outline-none"
            >
              <option value="score_desc">Sortare: Scor Oportunitate</option>
              <option value="budget_desc">Sortare: Buget Descrescator</option>
              <option value="budget_asc">Sortare: Buget Crescator</option>
              <option value="date_desc">Sortare: Cele mai recente</option>
            </select>
          </div>

          <div className="flex items-center gap-2.5 w-full lg:w-auto justify-end">
            <span className="text-xs text-slate-500 font-medium">{filteredLeads.length} semnale</span>

            <button
              onClick={() => loadWorkspace(true)}
              disabled={refreshing}
              className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 hover:text-slate-900 transition shadow-sm"
            >
              {refreshing ? "Se actualizeaza..." : "Actualizeaza date"}
            </button>

            <a
              href={"https://api.ro-intel.xyz/api/v1/tenants/" + (activeDesk?.id || "desk_default") + "/export/csv"}
              download
              className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition shadow-sm"
            >
              Export CSV
            </a>
          </div>
        </div>

        {loading ? (
          <div className="flex h-64 items-center justify-center text-xs text-slate-500 font-medium">Sincronizare registru pre-SEAP...</div>
        ) : filteredLeads.length === 0 ? (
          <div className="flex h-64 items-center justify-center text-xs text-slate-500">Nu exista semnale pentru criteriile selectate.</div>
        ) : (
          <ul className="bg-white border border-[#eaeaea] rounded-lg divide-y divide-[#eaeaea]">
            {filteredLeads.map((l, index) => {
              const isGated = !isSubscriber && index >= 2;
              return (
                <li
                  key={l.source_id}
                  onClick={() => setSelectedLead(l)}
                  className={"flex items-start gap-4 px-4 py-5 cursor-pointer transition " + (isGated ? "opacity-70" : "hover:bg-[#f7f7f7]")}
                >
                  <div className="hidden sm:flex h-14 w-14 shrink-0 items-center justify-center rounded bg-brand-50 border border-brand-100 text-[10px] font-bold text-brand-700 uppercase text-center leading-tight">
                    {l.category}
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2 mb-1.5 text-[11px]">
                      <span className="rounded bg-brand-50 px-2 py-0.5 font-bold text-brand-700 border border-brand-100 uppercase sm:hidden">
                        {l.category}
                      </span>
                      <span className="rounded bg-[#f7f7f7] px-2 py-0.5 font-semibold text-[#2b2b2b]">
                        {l.sub_category || "General"}
                      </span>
                      <span className="text-[#2b2b2b] opacity-60">
                        {l.locality}, {l.county}
                      </span>
                    </div>

                    <h4 className={"text-[15px] font-semibold text-[#111] mb-1 " + (isGated ? "blur-[2px]" : "")}>{l.project_title}</h4>
                    <p className="text-[13px] text-[#2b2b2b] opacity-70 mb-2">{l.entity_name} &bull; Sursa: <span className="font-semibold">{l.source_type}</span></p>

                    <p className={"text-[13px] text-[#2b2b2b] line-clamp-2 leading-relaxed " + (isGated ? "blur-[3px] select-none" : "")}>
                      {l.executive_summary}
                    </p>

                    <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-[11px] text-[#2b2b2b] opacity-70">
                      <div className="flex items-center gap-4">
                        <span>Publicat: <b className="opacity-100">{l.published_date || "2026-08-25"}</b></span>
                        <span>Termen Reactie: <b className="text-amber-700 opacity-100">{l.action_deadline || "T4 2026"}</b></span>
                      </div>
                      {isGated ? (
                        <span className="text-brand-700 font-bold opacity-100">Deblocheaza Dosarul &rarr;</span>
                      ) : (
                        <span className="text-brand-700 font-semibold opacity-100 hover:underline">Deschide Dosar Strategic &rarr;</span>
                      )}
                    </div>
                  </div>

                  <div className="text-right shrink-0">
                    <span className="block text-[15px] font-extrabold text-[#111]">
                      {l.financial_value_ron ? (l.financial_value_ron / 1000000).toFixed(1) + " Mil. RON" : "Buget Neestimat"}
                    </span>
                    <span className="block text-[11px] font-bold text-emerald-700 mt-0.5">Scor: {l.opportunity_score} / 10</span>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </main>

      {/* SLIDE-OVER DOSSIER */}
      {selectedLead && (
        <div className="fixed inset-y-0 right-0 z-40 w-full max-w-xl bg-white border-l border-slate-200 shadow-2xl p-6 overflow-y-auto flex flex-col justify-between">
          <div>
            <div className="flex justify-between items-start mb-4 border-b border-slate-200 pb-3">
              <div>
                <span className="text-[11px] font-bold text-brand-700 uppercase tracking-wide">Dosar Tehnic Pre-SEAP &bull; {selectedLead.source_id}</span>
                <h3 className="text-lg font-bold text-slate-900 mt-0.5">{selectedLead.project_title}</h3>
                <p className="text-xs text-slate-600">{selectedLead.entity_name} ({selectedLead.county})</p>
              </div>
              <button onClick={() => setSelectedLead(null)} className="text-slate-400 hover:text-slate-700 p-1 font-bold text-sm">✕</button>
            </div>

            <div className="space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-xl bg-slate-50 p-3.5 border border-slate-200">
                  <span className="text-[10px] text-slate-500 block uppercase font-semibold">Buget Estimat</span>
                  <span className="text-base font-extrabold text-slate-900">{(selectedLead.financial_value_ron / 1000000).toFixed(2)} Mil. RON</span>
                </div>
                <div className="rounded-xl bg-slate-50 p-3.5 border border-slate-200">
                  <span className="text-[10px] text-slate-500 block uppercase font-semibold">Sursa Finantare</span>
                  <span className="text-sm font-bold text-brand-800">{selectedLead.funding_source}</span>
                </div>
              </div>

              <div className="rounded-xl bg-slate-50 border border-slate-200 p-3.5 space-y-2">
                <div className="flex justify-between">
                  <span className="text-slate-500">Data Publicarii:</span>
                  <span className="font-semibold text-slate-800">{selectedLead.published_date}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Termen Limita Dialog Tehnic:</span>
                  <span className="font-semibold text-amber-700">{selectedLead.action_deadline || "Nespecificat"}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Registru Sursa:</span>
                  <span className="font-semibold text-slate-800">{selectedLead.source_type}</span>
                </div>
              </div>

              <div className="rounded-xl bg-brand-50 border border-brand-200 p-4">
                <span className="font-bold text-brand-900 block mb-1">Pozitionare Tehnica & Factori de Evaluare</span>
                <p className="text-slate-700 leading-relaxed">{selectedLead.sales_pitch_angle}</p>
              </div>

              <div className="pt-2 space-y-2">
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Actiuni Dosar</span>

                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => handleSaveToPipeline(selectedLead)}
                    className="rounded-lg bg-slate-900 p-2.5 text-center text-xs font-semibold text-white hover:bg-slate-800 transition shadow-sm"
                  >
                    Salveaza in Pipeline
                  </button>

                  <button
                    onClick={() => handleSendEmailAlert(selectedLead)}
                    disabled={emailSending}
                    className="rounded-lg border border-slate-300 bg-white p-2.5 text-center text-xs font-semibold text-slate-700 hover:bg-slate-50 transition shadow-sm"
                  >
                    {emailSending ? "Se expediaza..." : emailSentSuccess ? "Alerta Trimisa" : "Trimite Alerta Email"}
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-2 pt-1">
                  <button
                    onClick={() => openAnalyticsTool("competitor", selectedLead)}
                    className="rounded-lg border border-brand-300 bg-brand-50 p-2 text-center text-[11px] font-bold text-brand-800 hover:bg-brand-100 transition shadow-sm"
                  >
                    Radar Concurenta
                  </button>
                  <button
                    onClick={() => openDraftingTool("proposal", selectedLead)}
                    className="rounded-lg border border-slate-800 bg-slate-900 p-2 text-center text-[11px] font-bold text-white hover:bg-slate-800 transition shadow-sm"
                  >
                    Propunere Tehnica
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-2 pt-1">
                  <button onClick={() => openAnalyticsTool("caiet", selectedLead)} className="rounded-lg bg-slate-100 border border-slate-200 p-2 text-center text-[11px] font-semibold text-slate-800 hover:bg-slate-200">
                    Scanner Caiet
                  </button>
                  <button onClick={() => openAnalyticsTool("win", selectedLead)} className="rounded-lg bg-slate-100 border border-slate-200 p-2 text-center text-[11px] font-semibold text-slate-800 hover:bg-slate-200">
                    Simulator Sanse
                  </button>
                </div>
                <button
                  onClick={() => openDraftingTool("clarification", selectedLead)}
                  className="w-full rounded-lg bg-slate-100 border border-slate-200 p-2 text-center text-[11px] font-semibold text-slate-800 hover:bg-slate-200"
                >
                  Adresa Legea 544
                </button>
              </div>
            </div>
          </div>

          <a
            href={selectedLead.source_url}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-6 w-full rounded-xl bg-slate-900 py-2.5 text-center font-semibold text-xs text-white hover:bg-slate-800 transition block shadow-sm"
          >
            Acceseaza Documentul Oficial Sursa &rarr;
          </a>
        </div>
      )}
    </div>
  );
}
