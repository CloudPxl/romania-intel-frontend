"use client";
import React, { useState, useEffect } from "react";
import { useAuth } from "../context/AuthContext";
import { fetchTenantFeed, fetchTenantProducts, fetch72hMarketReport } from "../lib/api";
import {
  PricingModal,
  CaietScannerModal,
  WinOddsModal,
  ClarificationModal,
  BusinessEligibilityModal,
  CopilotChatModal
} from "../components/EnterpriseModals";

export default function DeskPage() {
  const { user, signInWithGoogle, signOut } = useAuth();
  const [tenantId, setTenantId] = useState("t1_infra_transilvania");
  const [products, setProducts] = useState<any[]>([]);
  const [selectedProduct, setSelectedProduct] = useState<string>("");
  const [activeCategory, setActiveCategory] = useState<string>("all");
  const [leads, setLeads] = useState<any[]>([]);
  const [selectedLead, setSelectedLead] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedCounty, setSelectedCounty] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [report72h, setReport72h] = useState<any>(null);
  const [profileDropdownOpen, setProfileDropdownOpen] = useState(false);

  // Modals
  const [pricingOpen, setPricingOpen] = useState(false);
  const [scannerOpen, setScannerOpen] = useState(false);
  const [winModalOpen, setWinModalOpen] = useState(false);
  const [clarificationOpen, setClarificationOpen] = useState(false);
  const [businessScannerOpen, setBusinessScannerOpen] = useState(false);
  const [copilotOpen, setCopilotOpen] = useState(false);

  const loadWorkspace = async (force = false) => {
    if (force) setRefreshing(true);
    else setLoading(true);

    try {
      const prodData = await fetchTenantProducts(tenantId);
      setProducts(prodData.products || []);

      const feedData = await fetchTenantFeed(tenantId, selectedProduct || undefined, activeCategory, force);
      setLeads(feedData.leads || []);

      const macroData = await fetch72hMarketReport(tenantId);
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
  }, [tenantId, activeCategory, selectedProduct]);

  const filteredLeads = leads.filter((l) => {
    const matchCounty = selectedCounty === "all" || l.county?.toLowerCase() === selectedCounty.toLowerCase();
    const matchSearch =
      !searchQuery ||
      l.project_title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      l.entity_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      l.locality?.toLowerCase().includes(searchQuery.toLowerCase());
    return matchCounty && matchSearch;
  });

  const totalPipeline = filteredLeads.reduce((acc, curr) => acc + (curr.financial_value_ron || 0), 0);

  return (
    <div className="min-h-screen bg-[#060b13] text-slate-100 flex flex-col font-sans">
      {/* 1. TOP EXECUTIVE BAR */}
      <header className="h-16 border-b border-[#182335] bg-[#0b111e]/90 backdrop-blur px-6 flex items-center justify-between sticky top-0 z-30">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <span className="h-3 w-3 rounded-full bg-emerald-400 animate-pulse"></span>
            <span className="font-bold text-lg tracking-wider text-white">
              RO-INTEL <span className="text-cyan-400 text-xs uppercase px-2 py-0.5 rounded bg-cyan-950 border border-cyan-800">2026</span>
            </span>
          </div>

          <select
            value={tenantId}
            onChange={(e) => {
              setTenantId(e.target.value);
              setSelectedProduct("");
            }}
            className="rounded-lg border border-[#1e293b] bg-[#101929] px-3 py-1.5 text-xs font-medium text-slate-300 focus:border-cyan-500 focus:outline-none"
          >
            <option value="t1_infra_transilvania">SC Infra Construct Transilvania SRL</option>
            <option value="t2_medtech_bucuresti">SC MedTech Pharma SRL</option>
            <option value="t3_vest_consulting_grants">SC Vest Project Consulting</option>
          </select>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={() => loadWorkspace(true)}
            disabled={refreshing}
            className="rounded-lg border border-[#1e293b] bg-[#101929] px-3 py-1.5 text-xs font-medium text-slate-300 hover:bg-[#182335] hover:text-white transition flex items-center gap-1.5"
          >
            <span className={refreshing ? "animate-spin" : ""}>↻</span> {refreshing ? "Se actualizează..." : "Actualizează Feed"}
          </button>

          <button
            onClick={() => setBusinessScannerOpen(true)}
            className="rounded-lg border border-cyan-800/80 bg-cyan-950/40 px-3 py-1.5 text-xs font-semibold text-cyan-300 hover:bg-cyan-900/50 transition"
          >
            ⚡ Scanner Eligibilitate Companie
          </button>

          <button
            onClick={() => setCopilotOpen(true)}
            className="rounded-lg border border-purple-800/80 bg-purple-950/40 px-3 py-1.5 text-xs font-semibold text-purple-300 hover:bg-purple-900/50 transition"
          >
            ✦ Copilot AI & Radar 72h
          </button>

          <button
            onClick={() => setPricingOpen(true)}
            className="rounded-lg bg-gradient-to-r from-cyan-500 to-blue-600 px-3.5 py-1.5 text-xs font-bold text-black hover:opacity-90 shadow-lg shadow-cyan-500/20 transition"
          >
            ★ Upgrade (499 / 1499 RON)
          </button>

          {/* Dynamic Profile Dropdown */}
          <div className="relative ml-2 pl-3 border-l border-slate-800">
            <button
              onClick={() => setProfileDropdownOpen(!profileDropdownOpen)}
              className="flex items-center gap-2 rounded-lg p-1 hover:bg-[#131d2e] transition"
            >
              <div className="h-7 w-7 rounded-full bg-cyan-900/80 flex items-center justify-center font-bold text-xs text-cyan-300 border border-cyan-700">
                {user?.full_name ? user.full_name.charAt(0).toUpperCase() : "U"}
              </div>
              <div className="hidden lg:block text-left">
                <span className="block text-[11px] font-bold text-slate-200 leading-none">{user?.full_name || "Utilizator Conectat"}</span>
                <span className="text-[10px] text-slate-400">{user?.role || "Director Bidding"}</span>
              </div>
            </button>

            {profileDropdownOpen && (
              <div className="absolute right-0 mt-2 w-64 rounded-xl border border-slate-800 bg-[#0b111e] p-3 shadow-2xl z-50 text-xs space-y-2">
                <div className="border-b border-slate-800 pb-2">
                  <p className="font-bold text-white">{user?.full_name}</p>
                  <p className="text-[11px] text-slate-400 truncate">{user?.email}</p>
                  <span className="inline-block mt-1 rounded bg-cyan-950 px-2 py-0.5 text-[10px] font-semibold text-cyan-400">
                    {user?.role}
                  </span>
                </div>

                <button
                  onClick={() => {
                    setProfileDropdownOpen(false);
                    signInWithGoogle();
                  }}
                  className="w-full rounded-lg bg-slate-800 py-2 text-center text-slate-200 hover:bg-slate-700 transition font-medium"
                >
                  Conectare cu Google
                </button>

                <button
                  onClick={() => {
                    setProfileDropdownOpen(false);
                    signOut();
                  }}
                  className="w-full rounded-lg bg-red-950/40 py-2 text-center text-red-400 hover:bg-red-900/40 transition font-medium"
                >
                  Deconectare
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* 2. BODY CONTENT */}
      <div className="flex-1 flex overflow-hidden">
        {/* SIDEBAR */}
        <aside className="w-72 border-r border-[#182335] bg-[#0b111e]/50 p-5 flex flex-col justify-between hidden md:flex">
          <div>
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-3">Categorii & Camere VIP</span>
            <div className="space-y-1 mb-5 text-xs">
              {[
                { id: "all", label: "Toate Categoriile" },
                { id: "infrastructura", label: "🏗 Infrastructură & Construcții" },
                { id: "sanatate", label: "🏥 Sănătate & Echipamente Medicale" },
                { id: "energie", label: "⚡ Energie & Parcuri Fotovoltaice" },
                { id: "aparare", label: "🔒 Apărare & Securitate VIP" }
              ].map((c) => (
                <button
                  key={c.id}
                  onClick={() => setActiveCategory(c.id)}
                  className={"w-full text-left rounded-lg px-3 py-2 font-medium transition " + (activeCategory === c.id ? "bg-cyan-500/10 text-cyan-400 border border-cyan-500/30 font-bold" : "text-slate-400 hover:bg-[#101929]")}
                >
                  {c.label}
                </button>
              ))}
            </div>

            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-2">Divizii de Produs</span>
            <div className="space-y-1 mb-5">
              <button
                onClick={() => setSelectedProduct("")}
                className={"w-full text-left rounded-lg px-3 py-1.5 text-xs transition " + (!selectedProduct ? "text-cyan-400 font-bold" : "text-slate-400 hover:bg-[#101929]")}
              >
                Toate Liniile
              </button>
              {products.map((p) => (
                <button
                  key={p.product_id}
                  onClick={() => setSelectedProduct(p.product_id)}
                  className={"w-full text-left rounded-lg px-3 py-1.5 text-xs transition " + (selectedProduct === p.product_id ? "text-cyan-400 font-bold" : "text-slate-400 hover:bg-[#101929]")}
                >
                  {p.name}
                </button>
              ))}
            </div>

            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-2">Filtru Județ</span>
            <select
              value={selectedCounty}
              onChange={(e) => setSelectedCounty(e.target.value)}
              className="w-full rounded-lg border border-[#1e293b] bg-[#101929] p-2 text-xs text-slate-300"
            >
              <option value="all">Toate Județele Active (8)</option>
              <option value="Iasi">Iași</option>
              <option value="Cluj">Cluj</option>
              <option value="Timis">Timiș</option>
              <option value="Bucuresti">București</option>
              <option value="Constanta">Constanța</option>
              <option value="Bihor">Bihor</option>
            </select>
          </div>

          <div className="rounded-xl border border-[#182335] bg-[#101929] p-3 text-xs text-slate-400">
            <span className="block text-[10px] uppercase font-bold text-slate-500">Volum Total Monitorizat</span>
            <span className="text-xl font-extrabold text-white mt-0.5 block">{(totalPipeline / 1000000).toFixed(1)} Mil. RON</span>
            <span className="text-[10px] text-emerald-400 font-medium">● 8 Registre Active 24/7</span>
          </div>
        </aside>

        {/* FEED */}
        <main className="flex-1 p-6 overflow-y-auto">
          <div className="flex flex-col md:flex-row gap-3 justify-between items-center mb-5">
            <input
              type="text"
              placeholder="Căutare proiect, autoritate sau cuvânt cheie..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full md:w-96 rounded-xl border border-[#1e293b] bg-[#0b111e] px-4 py-2 text-xs text-white placeholder-slate-500 focus:border-cyan-500 focus:outline-none"
            />
            <div className="flex items-center gap-3">
              <span className="text-xs text-slate-400 font-medium">{filteredLeads.length} Oportunități Calificate</span>
              <a
                href="https://api.ro-intel.xyz/api/v1/tenants/t1_infra_transilvania/export/csv"
                download
                className="rounded-lg border border-[#1e293b] bg-[#101929] px-3 py-1.5 text-xs text-slate-300 hover:text-white"
              >
                Export CSV
              </a>
            </div>
          </div>

          {loading ? (
            <div className="flex h-64 items-center justify-center text-xs text-slate-400">Sincronizare radar pre-SEAP...</div>
          ) : filteredLeads.length === 0 ? (
            <div className="flex h-64 items-center justify-center text-xs text-slate-500">Nu sunt semnale pentru filtrele selectate.</div>
          ) : (
            <div className="grid grid-cols-1 gap-3">
              {filteredLeads.map((l) => (
                <div
                  key={l.source_id}
                  onClick={() => setSelectedLead(l)}
                  className="rounded-xl border border-[#182335] bg-[#0b111e] p-4 hover:border-cyan-500/50 hover:bg-[#0f1726] cursor-pointer transition shadow-md"
                >
                  <div className="flex justify-between items-start mb-2">
                    <div className="flex items-center gap-2">
                      <span className="rounded bg-cyan-950 px-2 py-0.5 text-[10px] font-bold text-cyan-400 border border-cyan-800/40">
                        {l.category?.toUpperCase()}
                      </span>
                      <span className="text-xs text-slate-400">
                        {l.locality}, {l.county}
                      </span>
                    </div>
                    <div className="text-right">
                      <span className="text-base font-extrabold text-white">
                        {l.financial_value_ron ? (l.financial_value_ron / 1000000).toFixed(1) + " Mil. RON" : "Buget Neestimat"}
                      </span>
                      <span className="block text-[10px] font-bold text-emerald-400">Scor Oportunitate: {l.opportunity_score} / 10</span>
                    </div>
                  </div>

                  <h4 className="text-sm font-bold text-slate-100 mb-1">{l.project_title}</h4>
                  <p className="text-xs text-slate-400 mb-2 font-medium">{l.entity_name}</p>
                  <p className="text-xs text-slate-300 line-clamp-2 leading-relaxed bg-[#060b13] p-2.5 rounded-lg border border-[#182335]">
                    {l.executive_summary}
                  </p>

                  <div className="mt-3 flex items-center justify-between text-[11px] text-slate-400">
                    <span>Lansare Est.: <b className="text-slate-200">{l.estimated_timeline?.estimated_tender_launch || "T4 2026"}</b></span>
                    <span className="text-cyan-400 font-semibold hover:underline">Deschide Dosar & Instrumente →</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </main>
      </div>

      {/* 3. SLIDE-OVER DOSSIER */}
      {selectedLead && (
        <div className="fixed inset-y-0 right-0 z-40 w-full max-w-xl bg-[#0b111e] border-l border-[#182335] shadow-2xl p-6 overflow-y-auto flex flex-col justify-between">
          <div>
            <div className="flex justify-between items-start mb-4 border-b border-[#182335] pb-3">
              <div>
                <span className="text-xs font-bold text-cyan-400 uppercase tracking-wide">Dosar Achiziție Pre-SEAP</span>
                <h3 className="text-lg font-bold text-white mt-0.5">{selectedLead.project_title}</h3>
                <p className="text-xs text-slate-400">{selectedLead.entity_name} ({selectedLead.county})</p>
              </div>
              <button onClick={() => setSelectedLead(null)} className="text-slate-400 hover:text-white p-1">✕</button>
            </div>

            <div className="space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-xl bg-[#101929] p-3 border border-[#182335]">
                  <span className="text-[10px] text-slate-400 block">Buget Estimat</span>
                  <span className="text-base font-extrabold text-white">{(selectedLead.financial_value_ron / 1000000).toFixed(2)} Mil. RON</span>
                </div>
                <div className="rounded-xl bg-[#101929] p-3 border border-[#182335]">
                  <span className="text-[10px] text-slate-400 block">Sursă Finanțare</span>
                  <span className="text-base font-bold text-cyan-300">{selectedLead.funding_source}</span>
                </div>
              </div>

              <div className="rounded-xl bg-cyan-950/30 border border-cyan-800/40 p-3.5">
                <span className="font-bold text-cyan-400 block mb-1">Tactică Ofertare & Factori Tehnici</span>
                <p className="text-slate-200 leading-relaxed">{selectedLead.sales_pitch_angle}</p>
              </div>

              <div className="rounded-xl bg-[#101929] border border-[#182335] p-3.5 space-y-1.5">
                <div className="flex justify-between">
                  <span className="text-slate-400">Stadiu Curent:</span>
                  <span className="font-semibold text-slate-200">{selectedLead.estimated_timeline?.current_stage}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Fereastră Recomandată:</span>
                  <span className="font-semibold text-amber-400">{selectedLead.estimated_timeline?.recommended_action_window}</span>
                </div>
              </div>

              <div className="pt-2 space-y-2">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Instrumente Tactice Ofertare</span>
                <div className="grid grid-cols-3 gap-2">
                  <button onClick={() => setScannerOpen(true)} className="rounded-lg bg-amber-500/10 border border-amber-500/30 p-2 text-center text-[11px] font-bold text-amber-400 hover:bg-amber-500/20">
                    Scanner Caiet
                  </button>
                  <button onClick={() => setWinModalOpen(true)} className="rounded-lg bg-emerald-500/10 border border-emerald-500/30 p-2 text-center text-[11px] font-bold text-emerald-400 hover:bg-emerald-500/20">
                    Simulator Șanse
                  </button>
                  <button onClick={() => setClarificationOpen(true)} className="rounded-lg bg-cyan-500/10 border border-cyan-500/30 p-2 text-center text-[11px] font-bold text-cyan-400 hover:bg-cyan-500/20">
                    Adresă Legea 544
                  </button>
                </div>
              </div>
            </div>
          </div>

          <a
            href={selectedLead.source_url}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-6 w-full rounded-xl bg-slate-800 py-2.5 text-center font-bold text-xs text-white hover:bg-slate-700 transition block"
          >
            Accesează Documentul Oficial Sursă ↗
          </a>
        </div>
      )}

      {/* 4. MODALS */}
      <PricingModal isOpen={pricingOpen} onClose={() => setPricingOpen(false)} tenantId={tenantId} />
      <BusinessEligibilityModal isOpen={businessScannerOpen} onClose={() => setBusinessScannerOpen(false)} />
      <CopilotChatModal isOpen={copilotOpen} onClose={() => setCopilotOpen(false)} tenantId={tenantId} report72h={report72h} />
      <CaietScannerModal isOpen={scannerOpen} onClose={() => setScannerOpen(false)} defaultTitle={selectedLead?.project_title || ""} />
      <WinOddsModal isOpen={winModalOpen} onClose={() => setWinModalOpen(false)} defaultBudget={selectedLead?.financial_value_ron || 10000000} />
      <ClarificationModal isOpen={clarificationOpen} onClose={() => setClarificationOpen(false)} opp={selectedLead || {}} />
    </div>
  );
}
