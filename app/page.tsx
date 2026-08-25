"use client";
import React, { useState, useEffect } from "react";
import { useAuth } from "../context/AuthContext";
import { fetchTenantFeed, fetchTenantProducts, fetch72hMarketReport, addLeadToPipeline, triggerEmailAlert } from "../lib/api";
import {
  PricingModal,
  CaietScannerModal,
  WinOddsModal,
  ClarificationModal,
  BusinessEligibilityModal,
  CopilotChatModal,
  PipelineTrackerModal,
  AccountSettingsModal,
  WorkspaceDeskModal
} from "../components/EnterpriseModals";

export default function DeskPage() {
  const { user, preferences, desks, activeDesk, switchDesk } = useAuth();
  const [selectedDivision, setSelectedDivision] = useState<string>("all");
  const [activeCategory, setActiveCategory] = useState<string>("all");
  const [leads, setLeads] = useState<any[]>([]);
  const [selectedLead, setSelectedLead] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedCounty, setSelectedCounty] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState<string>("score_desc");
  const [report72h, setReport72h] = useState<any>(null);
  const [profileDropdownOpen, setProfileDropdownOpen] = useState(false);
  const [workspaceDropdownOpen, setWorkspaceDropdownOpen] = useState(false);
  const [emailSending, setEmailSending] = useState(false);
  const [emailSentSuccess, setEmailSentSuccess] = useState(false);

  // Modals
  const [pricingOpen, setPricingOpen] = useState(false);
  const [scannerOpen, setScannerOpen] = useState(false);
  const [winModalOpen, setWinModalOpen] = useState(false);
  const [clarificationOpen, setClarificationOpen] = useState(false);
  const [businessScannerOpen, setBusinessScannerOpen] = useState(false);
  const [copilotOpen, setCopilotOpen] = useState(false);
  const [pipelineOpen, setPipelineOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [deskManagerOpen, setDeskManagerOpen] = useState(false);

  const loadWorkspace = async (force = false) => {
    if (force) setRefreshing(true);
    else setLoading(true);

    try {
      const feedData = await fetchTenantFeed(activeDesk?.id || "desk_default", undefined, activeCategory, force);
      setLeads(feedData?.leads || []);

      const macroData = await fetch72hMarketReport(activeDesk?.id || "desk_default");
      setReport72h(macroData);
    } catch (err) {
      console.warn("[Desk] Load note:", err);
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

  // Filter and Score according to Active Desk's target counties & keywords
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
    <div className="min-h-screen bg-[#f8fafc] text-slate-900 flex flex-col font-sans">
      {/* 1. TOP BAR WITH CLEAN LOGO (NO 2026, NO GREEN DOT) & WORKING WORKSPACE SELECTOR */}
      <header className="h-16 border-b border-slate-200 bg-white px-6 flex items-center justify-between sticky top-0 z-30 shadow-sm">
        <div className="flex items-center gap-5">
          {/* Clean Logo */}
          <span className="font-bold text-base tracking-wider text-slate-900 uppercase">
            RO-INTEL
          </span>

          {/* Dynamic Desk / Workspace Selector */}
          <div className="relative">
            <button
              onClick={() => setWorkspaceDropdownOpen(!workspaceDropdownOpen)}
              className="flex items-center gap-2 rounded-lg border border-slate-300 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-800 hover:border-slate-400 hover:bg-white transition shadow-sm"
            >
              <span className="h-2 w-2 rounded-full bg-sky-600"></span>
              <span className="truncate max-w-[200px]">{activeDesk?.name || "Selecteaza Desk"}</span>
              <span className="text-[10px] text-slate-500 font-normal">▼</span>
            </button>

            {workspaceDropdownOpen && (
              <div className="absolute left-0 mt-2 w-72 rounded-xl border border-slate-200 bg-white p-2 shadow-xl z-50 text-xs space-y-1">
                <span className="text-[10px] uppercase font-bold text-slate-400 px-2 py-1 block">Companii & Desk-uri</span>
                {desks.map((d) => (
                  <button
                    key={d.id}
                    onClick={() => {
                      switchDesk(d.id);
                      setSelectedDivision("all");
                      setWorkspaceDropdownOpen(false);
                    }}
                    className={"w-full text-left rounded-lg px-2.5 py-2 transition flex items-center justify-between " + (activeDesk?.id === d.id ? "bg-sky-50 text-sky-800 font-bold border border-sky-200" : "text-slate-700 hover:bg-slate-100")}
                  >
                    <span className="truncate">{d.name}</span>
                    {activeDesk?.id === d.id && <span className="text-sky-700 text-xs font-bold">Activ</span>}
                  </button>
                ))}
                <div className="border-t border-slate-100 pt-1 mt-1">
                  <button
                    onClick={() => {
                      setWorkspaceDropdownOpen(false);
                      setDeskManagerOpen(true);
                    }}
                    className="w-full text-left rounded-lg px-2.5 py-1.5 font-bold text-sky-700 hover:bg-sky-50 transition"
                  >
                    + Administrare & Adaugare Companii
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setPipelineOpen(true)}
            className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 hover:text-slate-900 transition shadow-sm"
          >
            Pipeline Oportunitati
          </button>

          <button
            onClick={() => setBusinessScannerOpen(true)}
            className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 hover:text-slate-900 transition shadow-sm"
          >
            Eligibilitate Finantari
          </button>

          <button
            onClick={() => setCopilotOpen(true)}
            className="rounded-lg border border-sky-200 bg-sky-50 px-3 py-1.5 text-xs font-semibold text-sky-800 hover:bg-sky-100 transition shadow-sm"
          >
            Copilot AI & Radar 72h
          </button>

          <button
            onClick={() => setPricingOpen(true)}
            className="rounded-lg bg-slate-900 px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-slate-800 transition shadow-sm"
          >
            Factura Proforma / OP
          </button>

          <div className="relative ml-2 pl-3 border-l border-slate-200">
            <button
              onClick={() => setProfileDropdownOpen(!profileDropdownOpen)}
              className="flex items-center gap-2 rounded-lg p-1 hover:bg-slate-100 transition"
            >
              <div className="h-7 w-7 rounded-full bg-slate-200 flex items-center justify-center font-bold text-xs text-slate-700 border border-slate-300">
                {user?.full_name ? user.full_name.charAt(0).toUpperCase() : "U"}
              </div>
              <div className="hidden lg:block text-left">
                <span className="block text-[11px] font-bold text-slate-800 leading-none">{user?.full_name || "Cont Nelogat"}</span>
                <span className="text-[10px] text-slate-500">{user?.role || "Vizitator Desk"}</span>
              </div>
            </button>

            {profileDropdownOpen && (
              <div className="absolute right-0 mt-2 w-64 rounded-xl border border-slate-200 bg-white p-3 shadow-xl z-50 text-xs space-y-2">
                <div className="border-b border-slate-100 pb-2">
                  <p className="font-bold text-slate-900">{user?.full_name || "Utilizator Nelogat"}</p>
                  <p className="text-[11px] text-slate-500 truncate">{user?.email || "Acces limitat demo"}</p>
                  <span className="inline-block mt-1 rounded bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-700">
                    {user?.role || "Neautentificat"}
                  </span>
                </div>

                <button
                  onClick={() => {
                    setProfileDropdownOpen(false);
                    setSettingsOpen(true);
                  }}
                  className="w-full rounded-lg bg-slate-100 py-2 text-center text-slate-700 hover:bg-slate-200 transition font-medium"
                >
                  Setari Cont & Alerte
                </button>

                <button
                  onClick={() => {
                    setProfileDropdownOpen(false);
                    setDeskManagerOpen(true);
                  }}
                  className="w-full rounded-lg bg-slate-100 py-2 text-center text-slate-700 hover:bg-slate-200 transition font-medium"
                >
                  Companii & Desk-uri
                </button>

                {!user ? (
                  <button
                    onClick={() => {
                      setProfileDropdownOpen(false);
                      setSettingsOpen(true);
                    }}
                    className="w-full rounded-lg bg-sky-600 py-2 text-center text-white hover:bg-sky-700 transition font-bold"
                  >
                    Autentificare / Log in
                  </button>
                ) : (
                  <button
                    onClick={() => {
                      setProfileDropdownOpen(false);
                      setSettingsOpen(true);
                    }}
                    className="w-full rounded-lg bg-rose-50 py-2 text-center text-rose-700 hover:bg-rose-100 transition font-medium border border-rose-200"
                  >
                    Deconectare
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </header>

      {/* 2. BODY CONTENT */}
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
                  className={"w-full text-left rounded-lg px-3 py-2 font-medium transition " + (activeCategory === c.id ? "bg-sky-50 text-sky-800 border border-sky-200 font-bold" : "text-slate-600 hover:bg-slate-50 hover:text-slate-900")}
                >
                  {c.label}
                </button>
              ))}
            </div>

            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block mb-2">Divizii & Linii {activeDesk?.name ? `(${activeDesk.name.split(" ")[0]})` : ""}</span>
            <div className="space-y-1 mb-5">
              <button
                onClick={() => setSelectedDivision("all")}
                className={"w-full text-left rounded-lg px-3 py-1.5 text-xs transition " + (selectedDivision === "all" ? "text-sky-700 font-bold" : "text-slate-600 hover:bg-slate-50")}
              >
                Toate Liniile Desk
              </button>
              {activeDesk?.divisions?.map((d) => (
                <button
                  key={d.id}
                  onClick={() => setSelectedDivision(d.id)}
                  className={"w-full text-left rounded-lg px-3 py-1.5 text-xs transition " + (selectedDivision === d.id ? "text-sky-700 font-bold" : "text-slate-600 hover:bg-slate-50")}
                >
                  {d.name}
                </button>
              ))}
            </div>

            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block mb-2">Filtrare Judet</span>
            <select
              value={selectedCounty}
              onChange={(e) => setSelectedCounty(e.target.value)}
              className="w-full rounded-lg border border-slate-300 bg-slate-50 p-2 text-xs text-slate-800 focus:bg-white focus:outline-none focus:border-sky-500"
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
          {/* SEARCH & ISOLATED REFRESH BUTTON TOOLBAR */}
          <div className="flex flex-col lg:flex-row gap-3 justify-between items-center mb-6 bg-white p-3.5 rounded-xl border border-slate-200 shadow-sm">
            <div className="flex-1 w-full lg:w-auto flex items-center gap-2">
              <input
                type="text"
                placeholder="Cautare dupa proiect, autoritate, subcategorie sau cod..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full md:w-96 rounded-lg border border-slate-300 bg-slate-50 px-3 py-1.5 text-xs text-slate-900 placeholder-slate-400 focus:bg-white focus:border-sky-600 focus:outline-none"
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
              
              {/* ISOLATED REFRESH BUTTON */}
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
            <div className="grid grid-cols-1 gap-3.5">
              {filteredLeads.map((l, index) => {
                const isGated = !isSubscriber && index >= 2;
                return (
                  <div
                    key={l.source_id}
                    onClick={() => {
                      if (isGated) setPricingOpen(true);
                      else setSelectedLead(l);
                    }}
                    className={"relative rounded-xl border bg-white p-5 cursor-pointer transition shadow-sm " + (isGated ? "border-slate-200 opacity-80" : "border-slate-200 hover:border-sky-500 hover:shadow-md")}
                  >
                    <div className="flex justify-between items-start mb-2.5">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="rounded bg-sky-50 px-2 py-0.5 text-[10px] font-bold text-sky-800 border border-sky-200 uppercase">
                          {l.category}
                        </span>
                        <span className="rounded bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-700">
                          {l.sub_category || "General"}
                        </span>
                        <span className="text-xs text-slate-500">
                          {l.locality}, {l.county}
                        </span>
                      </div>
                      <div className="text-right">
                        <span className="text-base font-extrabold text-slate-900">
                          {l.financial_value_ron ? (l.financial_value_ron / 1000000).toFixed(1) + " Mil. RON" : "Buget Neestimat"}
                        </span>
                        <span className="block text-[11px] font-bold text-emerald-700">Scor: {l.opportunity_score} / 10</span>
                      </div>
                    </div>

                    <h4 className={"text-sm font-bold text-slate-900 mb-1 " + (isGated ? "blur-[2px]" : "")}>{l.project_title}</h4>
                    <p className="text-xs text-slate-600 mb-2 font-medium">{l.entity_name} &bull; Sursa: <span className="text-slate-800 font-semibold">{l.source_type}</span></p>
                    
                    <p className={"text-xs text-slate-700 line-clamp-2 leading-relaxed bg-slate-50 p-3 rounded-lg border border-slate-100 " + (isGated ? "blur-[3px] select-none" : "")}>
                      {l.executive_summary}
                    </p>

                    <div className="mt-3 flex flex-wrap items-center justify-between text-[11px] text-slate-500 border-t border-slate-100 pt-2.5">
                      <div className="flex items-center gap-4">
                        <span>Publicat: <b className="text-slate-800">{l.published_date || "2026-08-25"}</b></span>
                        <span>Termen Reactie: <b className="text-amber-700">{l.action_deadline || "T4 2026"}</b></span>
                      </div>
                      {isGated ? (
                        <span className="text-sky-700 font-bold">Deblocheaza Dosarul &rarr;</span>
                      ) : (
                        <span className="text-sky-700 font-semibold hover:underline">Deschide Dosar Strategic &rarr;</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </main>
      </div>

      {/* 3. SLIDE-OVER DOSSIER */}
      {selectedLead && (
        <div className="fixed inset-y-0 right-0 z-40 w-full max-w-xl bg-white border-l border-slate-200 shadow-2xl p-6 overflow-y-auto flex flex-col justify-between">
          <div>
            <div className="flex justify-between items-start mb-4 border-b border-slate-200 pb-3">
              <div>
                <span className="text-[11px] font-bold text-sky-700 uppercase tracking-wide">Dosar Tehnic Pre-SEAP &bull; {selectedLead.source_id}</span>
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
                  <span className="text-sm font-bold text-sky-800">{selectedLead.funding_source}</span>
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

              <div className="rounded-xl bg-sky-50 border border-sky-200 p-4">
                <span className="font-bold text-sky-900 block mb-1">Pozitionare Tehnica & Factori de Evaluare</span>
                <p className="teeading-relaxed">{selectedLead.sales_pitch_angle}</p>
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

                <div className="grid grid-cols-3 gap-2 pt-1">
                  <button onClick={() => setScannerOpen(true)} className="rounded-lg bg-slate-100 border border-slate-200 p-2 text-center text-[11px] font-semibold text-slate-800 hover:bg-slate-200">
                    Scanner Caiet
                  </button>
                  <button onClick={() => setWinModalOpen(true)} className="rounded-lg bg-slate-100 border border-slate-200 p-2 text-center text-[11px] font-semibold text-slate-800 hover:bg-slate-200">
                    Simulator Sanse
                  </button>
                  <button onClick={() => setClarificationOpen(true)} className="rounded-lg bg-slate-100 border border-slate-200 p-2 text-center text-[11px] font-semibold text-slate-800 hover:bg-slate-200">
                    Adresa Legea 544
                  </button>
                </div>
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

      {/* 4. MODALS */}
      <PricingModal isOpen={pricingOpen} onClose={() => setPricingOpen(false)} tenantId={activeDesk?.id || "desk_default"} />
      <BusinessEligibilityModal isOpen={businessScannerOpen} onClose={() => setBusinessScannerOpen(false)} />
      <CopilotChatModal isOpen={copilotOpen} onClose={() => setCopilotOpen(false)} tenantId={activeDesk?.id || "desk_default"} report72h={report72h} />
      <CaietScannerModal isOpen={scannerOpen} onClose={() => setScannerOpen(false)} defaultTitle={selectedLead?.project_title || ""} />
      <WinOddsModal isOpen={winModalOpen} onClose={() => setWinModalOpen(false)} defaultBudget={selectedLead?.financial_value_ron || 10000000} />
      <ClarificationModal isOpen={clarificationOpen} onClose={() => setClarificationOpen(false)} opp={selectedLead || {}} />
      <PipelineTrackerModal isOpen={pipelineOpen} onClose={() => setPipelineOpen(false)} tenantId={activeDesk?.id || "desk_default"} />
      <AccountSettingsModal isOpen={settingsOpen} onClose={() => setSettingsOpen(false)} />
      <WorkspaceDeskModal isOpen={deskManagerOpen} onClose={() => setDeskManagerOpen(false)} />
    </div>
  );
}
