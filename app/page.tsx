"use client";

import React, { useState, useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";
import { 
  LogOut, 
  LogIn, 
  ChevronRight, 
  Download, 
  Search, 
  ExternalLink, 
  Copy, 
  Check, 
  X, 
  Sparkles, 
  ChevronDown 
} from "lucide-react";

interface LeadItem {
  source_id: string;
  category: string;
  county: string;
  locality?: string;
  project_title: string;
  entity_name: string;
  financial_value_ron?: number;
  executive_summary: string;
  sales_pitch_angle: string;
  trade_tags: string[];
  opportunity_score: number;
  action_deadline?: string;
  source_url?: string;
}

export default function DeskPage() {
  const { user, signOut, switchWorkspace } = useAuth();
  const router = useRouter();

  const [activeCategory, setActiveCategory] = useState("infrastructura");
  const [activeTenant, setActiveTenant] = useState("t1_infra_transilvania");
  const [leads, setLeads] = useState<LeadItem[]>([]);
  const [filteredLeads, setFilteredLeads] = useState<LeadItem[]>([]);
  const [selectedLead, setSelectedLead] = useState<LeadItem | null>(null);
  const [analytics, setAnalytics] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCounty, setSelectedCounty] = useState("Toate");
  const [copied, setCopied] = useState(false);

  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const [showAnalyticsModal, setShowAnalyticsModal] = useState(false);

  const API_BASE = process.env.NEXT_PUBLIC_API_BASE || "https://ro-intel-engine.onrender.com";

  useEffect(() => {
    async function fetchData() {
      setLoading(true);
      try {
        const tenantId = user?.tenant_id || activeTenant;
        const [feedRes, analyticsRes] = await Promise.all([
          fetch(`${API_BASE}/api/v1/tenants/${tenantId}/feed`),
          fetch(`${API_BASE}/api/v1/tenants/${tenantId}/analytics`)
        ]);

        if (feedRes.ok) {
          const feedData = await feedRes.json();
          setLeads(feedData.leads || []);
        }
        if (analyticsRes.ok) {
          const analyticsData = await analyticsRes.json();
          setAnalytics(analyticsData);
        }
      } catch (err) {
        console.error("[Desk] Sync error:", err);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, [activeTenant, user?.tenant_id, API_BASE]);

  useEffect(() => {
    let result = [...leads];

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (l) =>
          l.project_title.toLowerCase().includes(q) ||
          l.entity_name.toLowerCase().includes(q) ||
          l.county.toLowerCase().includes(q)
      );
    }

    if (selectedCounty !== "Toate") {
      result = result.filter((l) => l.county.toLowerCase().includes(selectedCounty.toLowerCase()));
    }

    setFilteredLeads(result);
  }, [leads, searchQuery, selectedCounty]);

  const handleCopyDossier = (lead: LeadItem) => {
    const text = `PROIECT: ${lead.project_title}\nBENEFICIAR: ${lead.entity_name} (${lead.county})\nVALOARE: ${lead.financial_value_ron ? `${lead.financial_value_ron.toLocaleString()} RON` : 'N/A'}\nSCOR: ${lead.opportunity_score}/10\n\nSINTEZA EXECUTIVA:\n${lead.executive_summary}\n\nUNGHI TACTIC DE OFERTARE:\n${lead.sales_pitch_angle}\n\nDOCUMENT OFICIAL: ${lead.source_url || 'N/A'}`;
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const currentTenantName = 
    user?.tenant?.company_name || 
    (activeTenant === "t1_infra_transilvania" ? "SC Infra Construct Transilvania SRL" :
     activeTenant === "t2_medtech_bucuresti" ? "SC MedTech Pharma SRL" : "SC Vest Project Consulting");

  return (
    <div className="flex h-screen bg-[#070b12] text-zinc-100 font-sans overflow-hidden select-none">
      {/* SIDEBAR */}
      <aside className="w-64 bg-[#0c1019] border-r border-zinc-800/80 flex flex-col justify-between p-3.5 z-20">
        <div className="space-y-6">
          <div className="flex items-center gap-2.5 px-2 py-1">
            <div className="w-2.5 h-2.5 rounded-full bg-cyan-400 shadow-[0_0_8px_rgba(34,211,238,0.8)] animate-pulse" />
            <span className="font-bold text-xs tracking-wider uppercase text-zinc-200">RO-INTEL</span>
          </div>

          <div className="space-y-1">
            <span className="text-[10px] uppercase font-mono tracking-widest text-zinc-500 px-2 block mb-2">
              Desk-uri Active
            </span>
            <button
              onClick={() => setActiveCategory("infrastructura")}
              className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-medium transition cursor-pointer ${
                activeCategory === "infrastructura"
                  ? "bg-cyan-500 text-zinc-950 font-semibold shadow-md shadow-cyan-500/20"
                  : "text-zinc-400 hover:bg-zinc-800/50 hover:text-zinc-200"
              }`}
            >
              <div className="flex items-center gap-2">
                <span>🛣️</span>
                <span>Infrastructură</span>
              </div>
              <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded-md ${
                activeCategory === "infrastructura" ? "bg-zinc-950/20 text-zinc-950 font-bold" : "bg-zinc-800/60 text-zinc-400"
              }`}>
                {leads.length || 2}
              </span>
            </button>

            <button
              onClick={() => setActiveCategory("energie")}
              className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-medium transition cursor-pointer ${
                activeCategory === "energie"
                  ? "bg-cyan-500 text-zinc-950 font-semibold shadow-md shadow-cyan-500/20"
                  : "text-zinc-400 hover:bg-zinc-800/50 hover:text-zinc-200"
              }`}
            >
              <div className="flex items-center gap-2">
                <span>⚡</span>
                <span>Energie</span>
              </div>
              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded-md bg-zinc-800/60 text-zinc-400">4</span>
            </button>

            <button
              onClick={() => setActiveCategory("sanatate")}
              className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-medium transition cursor-pointer ${
                activeCategory === "sanatate"
                  ? "bg-cyan-500 text-zinc-950 font-semibold shadow-md shadow-cyan-500/20"
                  : "text-zinc-400 hover:bg-zinc-800/50 hover:text-zinc-200"
              }`}
            >
              <div className="flex items-center gap-2">
                <span>🏥</span>
                <span>Sănătate</span>
              </div>
              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded-md bg-zinc-800/60 text-zinc-400">1</span>
            </button>
          </div>

          <div className="space-y-1">
            <span className="text-[10px] uppercase font-mono tracking-widest text-zinc-500 px-2 block mb-2">
              Camere VIP
            </span>
            <div className="flex items-center justify-between px-3 py-2 rounded-xl text-xs text-zinc-500 cursor-not-allowed">
              <span>🔒 Apărare & Securitate</span>
              <span className="text-[10px] font-mono text-zinc-600">7 locuri</span>
            </div>
            <div className="flex items-center justify-between px-3 py-2 rounded-xl text-xs text-zinc-500 cursor-not-allowed">
              <span>🔒 M&A Confidențial</span>
              <span className="text-[10px] font-mono text-zinc-600">3 locuri</span>
            </div>
          </div>

          <div 
            onClick={() => setShowAnalyticsModal(true)}
            className="p-3.5 rounded-2xl bg-gradient-to-br from-cyan-950/30 via-zinc-900/60 to-zinc-900 border border-cyan-500/20 hover:border-cyan-500/40 transition cursor-pointer group"
          >
            <div className="flex items-center gap-2 text-cyan-400 text-xs font-semibold mb-1">
              <Sparkles className="w-3.5 h-3.5 text-cyan-400 group-hover:rotate-12 transition-transform" />
              <span>Briefing AI & Radar VIP</span>
            </div>
            <p className="text-[11px] text-zinc-400 leading-snug">
              Analiză de piață xAI Grok și alerte instantanee înainte de publicare.
            </p>
          </div>
        </div>

        {/* User Card */}
        <div className="relative">
          {profileMenuOpen && (
            <div className="absolute bottom-full left-0 right-0 mb-2 bg-[#111624] border border-zinc-700/80 rounded-2xl p-3 shadow-2xl backdrop-blur-xl z-50 space-y-2.5">
              <div className="pb-2 border-b border-zinc-800">
                <p className="text-xs font-semibold text-zinc-100">{user?.full_name || "Andrei Mureșan"}</p>
                <p className="text-[10px] text-zinc-400 font-mono">{user?.email || "andrei.muresan@infraconstruct.ro"}</p>
                <div className="mt-1.5 inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-cyan-950/80 border border-cyan-500/30 text-cyan-400 text-[9px] font-mono uppercase">
                  {currentTenantName.slice(0, 24)}...
                </div>
              </div>

              <div>
                <label className="text-[10px] text-zinc-500 font-mono block mb-1">SCHIMBĂ WORKSPACE</label>
                <select
                  value={user?.tenant_id || activeTenant}
                  onChange={(e) => {
                    const tid = e.target.value;
                    setActiveTenant(tid);
                    if (switchWorkspace) switchWorkspace(tid);
                  }}
                  className="w-full bg-zinc-900 border border-zinc-700 text-zinc-200 text-xs rounded-lg px-2 py-1.5 focus:outline-none focus:border-cyan-500"
                >
                  <option value="t1_infra_transilvania">SC Infra Construct SRL (VIP)</option>
                  <option value="t2_medtech_bucuresti">SC MedTech Pharma SRL</option>
                  <option value="t3_vest_consulting_grants">SC Vest Project Consulting</option>
                </select>
              </div>

              <div className="pt-1 space-y-1">
                <button
                  onClick={() => router.push("/login")}
                  className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs text-zinc-300 hover:bg-zinc-800 transition cursor-pointer"
                >
                  <LogIn className="w-3.5 h-3.5 text-cyan-400" />
                  <span>Schimbă Contul / Login</span>
                </button>
                <button
                  onClick={() => {
                    if (signOut) signOut();
                    setProfileMenuOpen(false);
                    router.push("/login");
                  }}
                  className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs text-rose-400 hover:bg-rose-950/30 transition cursor-pointer"
                >
                  <LogOut className="w-3.5 h-3.5 text-rose-400" />
                  <span>Deconectare (Logout)</span>
                </button>
              </div>
            </div>
          )}

          <div
            onClick={() => setProfileMenuOpen(!profileMenuOpen)}
            className="flex items-center justify-between p-2 rounded-xl bg-zinc-900/60 border border-zinc-800/80 hover:border-zinc-700 transition cursor-pointer"
          >
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-lg bg-zinc-800 border border-zinc-700 flex items-center justify-center text-xs font-semibold text-zinc-200 font-mono">
                {user?.full_name ? user.full_name.split(' ').map((n: string) => n[0]).join('') : "AM"}
              </div>
              <div className="text-left">
                <p className="text-xs font-medium text-zinc-200 leading-none">{user?.full_name || "Andrei Mureșan"}</p>
                <p className="text-[10px] text-zinc-500 mt-0.5">{user?.role === 'owner' ? 'Head Executive' : (user?.role || 'Head Executive')}</p>
              </div>
            </div>
            <ChevronDown className={`w-3.5 h-3.5 text-zinc-400 transition-transform ${profileMenuOpen ? "rotate-180" : ""}`} />
          </div>
        </div>
      </aside>

      {/* MAIN FEED */}
      <main className="flex-1 flex flex-col overflow-hidden bg-[#070b12]">
        <header className="h-16 px-8 border-b border-zinc-800/70 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-950/60 border border-emerald-500/30 text-emerald-400 text-[11px] font-mono">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              Domeniul {activeCategory === "infrastructura" ? "Infrastructură" : activeCategory === "energie" ? "Energie" : "Sănătate"}
            </span>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowAnalyticsModal(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-zinc-900 border border-zinc-800 hover:border-cyan-500/50 text-xs text-zinc-300 transition cursor-pointer"
            >
              <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
              <span>Briefing AI</span>
            </button>
            <a
              href={`${API_BASE}/api/v1/tenants/${user?.tenant_id || activeTenant}/export/csv`}
              download
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-zinc-950 font-semibold text-xs transition shadow-md shadow-cyan-500/20 cursor-pointer"
            >
              <Download className="w-3.5 h-3.5 text-zinc-950" />
              <span>Export CSV</span>
            </a>
          </div>
        </header>

        <div className="p-8 pb-4 space-y-4">
          <h1 className="text-xl font-bold tracking-tight text-white">
            Radar comercial — {activeCategory === "infrastructura" ? "Infrastructură" : activeCategory === "energie" ? "Energie" : "Sănătate"}
          </h1>

          <div className="flex items-center gap-3">
            <div className="flex-1 relative">
              <Search className="w-4 h-4 text-zinc-500 absolute left-3.5 top-3" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Caută proiect, beneficiar sau semnal..."
                className="w-full h-10 bg-[#0d121f] border border-zinc-800/80 rounded-xl pl-10 pr-4 text-xs text-zinc-200 placeholder:text-zinc-500 focus:outline-none focus:border-cyan-500/60"
              />
            </div>

            <select
              value={selectedCounty}
              onChange={(e) => setSelectedCounty(e.target.value)}
              className="h-10 bg-[#0d121f] border border-zinc-800/80 text-zinc-300 text-xs rounded-xl px-3 focus:outline-none focus:border-cyan-500/60 cursor-pointer"
            >
              <option value="Toate">Toate județele</option>
              <option value="Bucuresti">București</option>
              <option value="Cluj">Cluj</option>
              <option value="Timis">Timiș</option>
              <option value="Bihor">Bihor</option>
            </select>

            <div className="h-10 px-3 bg-[#0d121f] border border-zinc-800/80 rounded-xl flex items-center gap-2 text-xs font-mono text-zinc-400">
              <span className="text-cyan-400 font-bold">8.0</span>
              <span className="text-[10px] text-zinc-600">MIN SCORE</span>
            </div>
          </div>

          <div className="flex items-center gap-2 text-[11px] text-zinc-500 font-mono pt-1">
            <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-ping" />
            <span>Feed Live</span>
            <span>•</span>
            <span className="text-zinc-400">{filteredLeads.length} oportunități prioritare</span>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-8 pb-8 space-y-3">
          {loading ? (
            <div className="text-center py-24 text-xs font-mono text-zinc-500">
              Se sincronizează stream-ul securizat cu Render & Supabase...
            </div>
          ) : filteredLeads.length === 0 ? (
            <div className="text-center py-24 text-xs font-mono text-zinc-500">
              Niciun dosar comercial găsit pe criteriile selectate.
            </div>
          ) : (
            filteredLeads.map((lead, idx) => (
              <div
                key={lead.source_id || idx}
                onClick={() => setSelectedLead(lead)}
                className={`p-4 rounded-2xl border transition-all cursor-pointer flex items-center justify-between ${
                  selectedLead?.source_id === lead.source_id
                    ? "bg-cyan-950/20 border-cyan-500/60 shadow-lg shadow-cyan-950/40"
                    : "bg-[#0d121f]/90 border-zinc-800/80 hover:border-zinc-700 hover:bg-[#111726]"
                }`}
              >
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-xl bg-zinc-900 border border-zinc-800 flex items-center justify-center font-mono font-bold text-xs text-zinc-200">
                    {lead.opportunity_score ? `${lead.opportunity_score}.0` : '8.0'}
                  </div>

                  <div className="space-y-1">
                    <div className="flex items-center gap-2 text-[10px] font-mono">
                      <span className="px-1.5 py-0.5 rounded bg-zinc-800/80 text-cyan-400 border border-cyan-500/20">
                        {lead.category ? lead.category.toUpperCase() : "PRE-SICAP"}
                      </span>
                      <span className="text-zinc-500">•</span>
                      <span className="text-zinc-400">Pre-anunț</span>
                    </div>
                    <h3 className="text-xs font-semibold text-zinc-100 hover:text-cyan-400 transition">
                      {lead.project_title}
                    </h3>
                    <p className="text-[11px] text-zinc-500">
                      {lead.entity_name} — {lead.county}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-6">
                  <div className="text-right">
                    <div className="text-xs font-semibold font-mono text-zinc-100">
                      {lead.financial_value_ron ? `${(lead.financial_value_ron / 1000000).toFixed(1)} mil. RON` : (idx === 0 ? "18.2 mil. EUR" : "27.5 mil. EUR")}
                    </div>
                    <div className="text-[10px] text-zinc-500 font-mono">
                      {idx === 0 ? "acum 12 min" : "acum 2 h"}
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-zinc-600" />
                </div>
              </div>
            ))
          )}
        </div>
      </main>

      {/* EXECUTIVE DOSSIER DRAWER */}
      {selectedLead && (
        <aside className="w-[420px] bg-[#0c1019] border-l border-zinc-800/80 p-6 flex flex-col justify-between overflow-y-auto z-30 animate-in slide-in-from-right duration-200">
          <div className="space-y-5">
            <div className="flex items-center justify-between pb-3 border-b border-zinc-800">
              <div className="flex items-center gap-2">
                <span className="text-xs font-mono font-semibold text-cyan-400">
                  DOSAR #{selectedLead.source_id ? selectedLead.source_id.slice(0, 8) : "REF"}
                </span>
                <span className="text-[10px] px-2 py-0.5 rounded bg-cyan-950 border border-cyan-500/30 text-cyan-300 font-mono">
                  Scor: {selectedLead.opportunity_score}/10
                </span>
              </div>
              <button
                onClick={() => setSelectedLead(null)}
                className="w-7 h-7 rounded-lg bg-zinc-900 border border-zinc-800 flex items-center justify-center text-zinc-400 hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div>
              <h2 className="text-sm font-semibold text-zinc-100 leading-snug">{selectedLead.project_title}</h2>
              <p className="text-xs text-zinc-400 mt-1 font-mono">{selectedLead.entity_name} • {selectedLead.county}</p>
            </div>

            <div>
              <h4 className="text-[10px] uppercase font-mono tracking-widest text-zinc-400 mb-1.5">Sinteză Executivă</h4>
              <div className="text-xs text-zinc-300 leading-relaxed bg-[#111624] p-3.5 rounded-xl border border-zinc-800/80">
                {selectedLead.executive_summary}
              </div>
            </div>

            <div>
              <h4 className="text-[10px] uppercase font-mono tracking-widest text-cyan-400 mb-1.5 flex items-center gap-1.5">
                <Sparkles className="w-3 h-3 text-cyan-400" />
                <span>Unghi Tactic de Ofertare (Battlecard)</span>
              </h4>
              <div className="text-xs text-zinc-200 leading-relaxed bg-cyan-950/20 p-3.5 rounded-xl border border-cyan-500/30">
                {selectedLead.sales_pitch_angle}
              </div>
            </div>

            {selectedLead.trade_tags && selectedLead.trade_tags.length > 0 && (
              <div>
                <h4 className="text-[10px] uppercase font-mono tracking-widest text-zinc-400 mb-1.5">Etichete Industriale</h4>
                <div className="flex flex-wrap gap-1.5">
                  {selectedLead.trade_tags.map((tag) => (
                    <span key={tag} className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-zinc-900 border border-zinc-800 text-zinc-300">
                      #{tag}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="pt-5 border-t border-zinc-800 space-y-2">
            {selectedLead.source_url && (
              <a
                href={selectedLead.source_url}
                target="_blank"
                rel="noreferrer"
                className="w-full h-10 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-zinc-950 text-xs font-semibold flex items-center justify-center gap-2 transition cursor-pointer"
              >
                <span>Verifică Documentul Oficial</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            )}

            <button
              onClick={() => handleCopyDossier(selectedLead)}
              className="w-full h-10 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 text-zinc-200 text-xs font-medium flex items-center justify-center gap-2 transition cursor-pointer"
            >
              {copied ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                  <span className="text-emerald-400">Referință Copiată!</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5 text-zinc-400" />
                  <span>Copiază Referința Comercială</span>
                </>
              )}
            </button>
          </div>
        </aside>
      )}

      {/* xAI GROK MODAL */}
      {showAnalyticsModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="w-full max-w-2xl bg-[#0e1320] border border-cyan-500/30 rounded-3xl p-6 shadow-2xl space-y-5 animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-zinc-800">
              <div className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-cyan-400" />
                <h3 className="text-sm font-semibold text-white">Analiză de Piață & Briefing Strategic xAI Grok</h3>
              </div>
              <button
                onClick={() => setShowAnalyticsModal(false)}
                className="w-7 h-7 rounded-lg bg-zinc-900 border border-zinc-800 flex items-center justify-center text-zinc-400 hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div className="p-3 rounded-xl bg-zinc-900/80 border border-zinc-800 text-center">
                <span className="text-[10px] text-zinc-500 font-mono block">PIPELINE TOTAL</span>
                <span className="text-xs font-bold text-cyan-400 font-mono">
                  {analytics?.telemetry?.total_pipeline_ron?.toLocaleString() || "0"} RON
                </span>
              </div>
              <div className="p-3 rounded-xl bg-zinc-900/80 border border-zinc-800 text-center">
                <span className="text-[10px] text-zinc-500 font-mono block">DOSARE CALIFICATE</span>
                <span className="text-xs font-bold text-white font-mono">{analytics?.telemetry?.total_qualified_leads || leads.length}</span>
              </div>
              <div className="p-3 rounded-xl bg-zinc-900/80 border border-zinc-800 text-center">
                <span className="text-[10px] text-zinc-500 font-mono block">SCOR MEDIU</span>
                <span className="text-xs font-bold text-emerald-400 font-mono">{analytics?.telemetry?.avg_opportunity_score || "8.0"}/10</span>
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-cyan-950/20 border border-cyan-500/30 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-mono text-cyan-400 font-bold uppercase">MEMO EXECUTIV B2B</span>
                <span className="text-[10px] px-2 py-0.5 rounded bg-cyan-900/50 text-cyan-300 font-mono">
                  {analytics?.ai_strategic_briefing?.procurement_trend || "Infrastructură & PNRR"}
                </span>
              </div>
              <p className="text-xs text-zinc-200 leading-relaxed">
                {analytics?.ai_strategic_briefing?.executive_summary || "Portofoliul curent beneficiază de o densitate ridicată a investițiilor publice în faza de autorizare și pre-anunț SEAP."}
              </p>
            </div>

            {analytics?.ai_strategic_briefing?.tactical_actions && (
              <div className="space-y-2">
                <span className="text-[10px] font-mono text-zinc-400 uppercase tracking-wider block">
                  3 ACȚIUNI TACTICE PENTRU ECHIPA COMERCIALĂ:
                </span>
                <ul className="space-y-1.5">
                  {analytics.ai_strategic_briefing.tactical_actions.map((act: string, i: number) => (
                    <li key={i} className="text-xs text-zinc-300 flex items-start gap-2 bg-zinc-900/50 p-2.5 rounded-xl border border-zinc-800">
                      <span className="text-cyan-400 font-mono font-bold">{i + 1}.</span>
                      <span>{act}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
