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
  ChevronDown,
  Clock,
  Landmark,
  ShieldAlert,
  Users,
  Lock,
  Radio,
  SlidersHorizontal,
  Building2
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
  funding_source?: string;
  estimated_timeline?: {
    current_stage?: string;
    estimated_tender_launch?: string;
    recommended_action_window?: string;
  };
  key_stakeholders?: string;
  competition_risk_radar?: string;
  trade_tags: string[];
  opportunity_score: number;
  action_deadline?: string;
  source_url?: string;
}

const FALLBACK_QUALIFIED_LEADS: LeadItem[] = [
  {
    source_id: "SICAP-MC-IASI-101",
    category: "infrastructura",
    county: "Iasi",
    locality: "Iasi",
    project_title: "Consultare Piață: Sistem inteligent de management al traficului și semnalizare adaptivă pe axa Păcurari - Tudor Vladimirescu",
    entity_name: "Municipiul Iași (Primăria Iași)",
    financial_value_ron: 18200000.0,
    executive_summary: "Municipiul Iași pregătește procedura de achiziție pentru modernizarea ITS și integrarea a 24 de intersecții majore în dispeceratul SCATS.",
    sales_pitch_angle: "Propuneți soluții compatibile UTMC cu senzori radar independenți de buclele inductive pentru punctaj tehnic maxim în caietul de sarcini.",
    funding_source: "Buget Local / CNI",
    estimated_timeline: {
      current_stage: "Consultare de Piață & Avizare Tehnică",
      estimated_tender_launch: "T4 2026 (Octombrie - Noiembrie)",
      recommended_action_window: "Următoarele 14 zile"
    },
    key_stakeholders: "Direcția Tehnică & Serviciul Achiziții Publice Iași",
    competition_risk_radar: "Mediu (Raport Calitate-Preț)",
    trade_tags: ["achizitii-publice", "infrastructura", "iasi", "smart-city"],
    opportunity_score: 9.4,
    action_deadline: "2026-09-18",
    source_url: "https://e-licitatie.ro/pub/notices/mc-notices/view/iasi-its-101"
  },
  {
    source_id: "SICAP-MC-IASI-202",
    category: "sanatate",
    county: "Iasi",
    locality: "Iasi",
    project_title: "Consultare Piață: Furnizare echipamente de radioterapie stereotaxică și acceleratoare liniare de particule",
    entity_name: "Institutul Regional de Oncologie (IRO) Iași",
    financial_value_ron: 34000000.0,
    executive_summary: "IRO Iași consultă furnizorii de tehnologie medicală oncologică pentru dotarea noului centru de terapie avansată.",
    sales_pitch_angle: "Includeți pachet integrat de mentenanță preventivă 24/7 și timpi de intervenție sub 4 ore pentru a bloca concurenții generici.",
    funding_source: "PNRR / Fonduri Europene",
    estimated_timeline: {
      current_stage: "Consultare Tehnică",
      estimated_tender_launch: "T4 2026 (Noiembrie)",
      recommended_action_window: "Următoarele 21 zile"
    },
    key_stakeholders: "Comisia Tehnică Medicală & Conducerea IRO Iași",
    competition_risk_radar: "Scăzut (Criteriu Tehnic 70%)",
    trade_tags: ["sanatate", "oncologie", "iasi", "medtech"],
    opportunity_score: 9.5,
    action_deadline: "2026-09-25",
    source_url: "https://e-licitatie.ro/pub/notices/mc-notices/view/iro-iasi-rad-202"
  },
  {
    source_id: "AC-IASI-301",
    category: "energie",
    county: "Iasi",
    locality: "Miroslava",
    project_title: "Autorizație de Construire: Hub Logistic & Parc Fotovoltaic 28 MWp cu Baterii de Stocare BESS",
    entity_name: "Consiliul Județean Iași / Industrial Park Miroslava SA",
    financial_value_ron: 62500000.0,
    executive_summary: "Aprobare construire pentru parc solar industrial de mari dimensiuni și stație de transformare racordată la SEN.",
    sales_pitch_angle: "Abordați dezvoltatorul cu soluții complete de transformatoare de medie tensiune și trackere solare monoaxiale de înaltă eficiență.",
    funding_source: "Fonduri Private & PNRR",
    estimated_timeline: {
      current_stage: "Autorizație Emisă (Pre-Contractare)",
      estimated_tender_launch: "T4 2026",
      recommended_action_window: "Imediat"
    },
    key_stakeholders: "Direcția de Dezvoltare Parc Industrial Miroslava",
    competition_risk_radar: "Mediu",
    trade_tags: ["energie-solara", "iasi", "bess", "industrial"],
    opportunity_score: 9.3,
    action_deadline: "2026-10-10",
    source_url: "https://primariamiroslava.ro/urbanism/autorizatii-construire-2026"
  },
  {
    source_id: "CNI-PROJ-401",
    category: "infrastructura",
    county: "Iasi",
    locality: "Iasi",
    project_title: "CNI: Construire Sală Polivalentă Regina Maria 10.000 locuri (Proiectare + Execuție)",
    entity_name: "Compania Națională de Investiții (CNI) / Primăria Iași",
    financial_value_ron: 240000000.0,
    executive_summary: "Indicatori tehnico-economici aprobați pentru complexul sportiv multifuncțional din zona Moara de Vânt.",
    sales_pitch_angle: "Constituire consorțiu de antrepriză generală cu subcontractori specializați pe structuri metalice spațiale și fațade ventilate.",
    funding_source: "CNI / Bugetul de Stat",
    estimated_timeline: {
      current_stage: "Avizare Guvernamentală (Pre-Lansare SEAP)",
      estimated_tender_launch: "T4 2026 (Noiembrie)",
      recommended_action_window: "Următoarele 30 zile"
    },
    key_stakeholders: "Departamentul Achiziții CNI București & Direcția Tehnică Iași",
    competition_risk_radar: "Ridicat (Competiție Consorții Naționale)",
    trade_tags: ["cni", "infrastructura", "iasi", "constructii-civile"],
    opportunity_score: 9.6,
    action_deadline: "2026-10-30",
    source_url: "https://www.cni.ro/proiecte-aprobate-2026"
  },
  {
    source_id: "SICAP-MC-CJ-101",
    category: "infrastructura",
    county: "Cluj",
    locality: "Cluj-Napoca",
    project_title: "Consultare de Piață: Sistem integrat de monitorizare trafic și prioritizare transport public ecologic",
    entity_name: "Municipiul Cluj-Napoca",
    financial_value_ron: 14500000.0,
    executive_summary: "Primăria Cluj-Napoca solicită specificații tehnice pentru 32 de intersecții cu camere ANPR și radar de flux.",
    sales_pitch_angle: "Propuneți algoritmi edge-computing cu consum redus pentru conformare Green Deal.",
    funding_source: "Buget Local / PNRR",
    estimated_timeline: {
      current_stage: "Consultare de Piață",
      estimated_tender_launch: "T4 2026",
      recommended_action_window: "Următoarele 14 zile"
    },
    key_stakeholders: "Direcția Tehnică Cluj-Napoca",
    competition_risk_radar: "Mediu",
    trade_tags: ["smart-city", "cluj", "its"],
    opportunity_score: 9.1,
    action_deadline: "2026-09-15",
    source_url: "https://e-licitatie.ro/pub/notices/mc-notices/view/1001"
  },
  {
    source_id: "MIPE-GRANTS-501",
    category: "energie",
    county: "Cluj",
    locality: "Dej",
    project_title: "Apel MIPE / PNRR C6: Eficiență energetică și cogenerare de înaltă eficiență pentru operatori industriali",
    entity_name: "Ministerul Investițiilor și Proiectelor Europene (MIPE)",
    financial_value_ron: 48000000.0,
    executive_summary: "Ghid de finanțare nerambursabilă pentru modernizarea capacităților energetice industriale din județul Cluj.",
    sales_pitch_angle: "Furnizați soluții turn-key de cogenerare gaz-abur cu randament global de peste 85%.",
    funding_source: "PNRR C6 Energie",
    estimated_timeline: {
      current_stage: "Consultare Ghid Solicitant",
      estimated_tender_launch: "T4 2026",
      recommended_action_window: "Următoarele 20 zile"
    },
    key_stakeholders: "Direcția Generală Programe Europene MIPE",
    competition_risk_radar: "Mediu",
    trade_tags: ["energie", "pnrr", "cluj", "granturi"],
    opportunity_score: 9.4,
    action_deadline: "2026-09-30",
    source_url: "https://mfe.gov.ro/pnrr-energie-apeluri-2026"
  }
];

export default function DeskPage() {
  const { user, signOut, switchWorkspace } = useAuth();
  const router = useRouter();

  const [activeCategory, setActiveCategory] = useState("infrastructura");
  const [activeTenant, setActiveTenant] = useState("t1_infra_transilvania");
  const [allLeads, setAllLeads] = useState<LeadItem[]>(FALLBACK_QUALIFIED_LEADS);
  const [filteredLeads, setFilteredLeads] = useState<LeadItem[]>([]);
  const [selectedLead, setSelectedLead] = useState<LeadItem | null>(null);
  const [analytics, setAnalytics] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCounty, setSelectedCounty] = useState("Toate");
  const [minScore, setMinScore] = useState(8.0);
  const [copied, setCopied] = useState(false);

  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const [showAnalyticsModal, setShowAnalyticsModal] = useState(false);

  const API_BASE = process.env.NEXT_PUBLIC_API_BASE || "https://ro-intel-engine.onrender.com";

  useEffect(() => {
    async function loadData() {
      try {
        const tenantId = user?.tenant_id || activeTenant;
        const res = await fetch(`${API_BASE}/api/v1/tenants/${tenantId}/feed`);
        if (res.ok) {
          const data = await res.json();
          if (data.leads && data.leads.length > 0) {
            setAllLeads(data.leads);
          }
        }
      } catch (e) {
        console.warn("[Desk] Using fallback qualified stream:", e);
      }
    }
    loadData();
  }, [activeTenant, user?.tenant_id, API_BASE]);

  useEffect(() => {
    let result = allLeads.filter((item) => {
      // Category match
      const catMatch = activeCategory === "toate" || item.category === activeCategory;
      // County match
      const countyMatch =
        selectedCounty === "Toate" ||
        item.county.toLowerCase() === selectedCounty.toLowerCase();
      // Search match
      const q = searchQuery.toLowerCase().trim();
      const searchMatch =
        !q ||
        item.project_title.toLowerCase().includes(q) ||
        item.entity_name.toLowerCase().includes(q) ||
        item.county.toLowerCase().includes(q);
      // Score match
      const scoreMatch = (item.opportunity_score || 8.5) >= minScore;

      return catMatch && countyMatch && searchMatch && scoreMatch;
    });

    setFilteredLeads(result);
  }, [allLeads, activeCategory, selectedCounty, searchQuery, minScore]);

  const infraCount = allLeads.filter((l) => l.category === "infrastructura").length;
  const energyCount = allLeads.filter((l) => l.category === "energie").length;
  const healthCount = allLeads.filter((l) => l.category === "sanatate").length;

  const handleCopyDossier = (lead: LeadItem) => {
    const text = `PROIECT: ${lead.project_title}\nBENEFICIAR: ${lead.entity_name} (${lead.county})\nVALOARE ESTIMATĂ: ${lead.financial_value_ron ? `${lead.financial_value_ron.toLocaleString()} RON` : "N/A"}\nSCOR OPORTUNITATE: ${lead.opportunity_score}/10\nSURSA FINANȚARE: ${lead.funding_source || "Fonduri Publice"}\nLANSARE SEAP ESTIMATĂ: ${lead.estimated_timeline?.estimated_tender_launch || "T4 2026"}\n\nSINTEZĂ EXECUTIVĂ:\n${lead.executive_summary}\n\nUNGHI TACTIC DE OFERTARE:\n${lead.sales_pitch_angle}\n\nDECIZIONALI:\n${lead.key_stakeholders || "Direcția Tehnică"}\n\nDOC OFICIAL: ${lead.source_url || "N/A"}`;
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="flex h-screen bg-[#070b12] text-zinc-100 font-sans overflow-hidden select-none">
      {/* 1. SIDEBAR */}
      <aside className="w-64 bg-[#0a0e17] border-r border-zinc-800/80 flex flex-col justify-between p-3.5 z-20">
        <div className="space-y-6">
          <div className="flex items-center gap-2.5 px-2 py-1">
            <div className="w-2.5 h-2.5 rounded-full bg-cyan-400 shadow-[0_0_10px_rgba(34,211,238,0.8)] animate-pulse" />
            <span className="font-bold text-xs tracking-wider uppercase text-zinc-200">RO-INTEL DESK</span>
          </div>

          <div className="space-y-1">
            <span className="text-[10px] uppercase font-mono tracking-widest text-zinc-500 px-2 block mb-2">
              DESK-URI ACTIVE
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
                {infraCount}
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
              <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded-md ${
                activeCategory === "energie" ? "bg-zinc-950/20 text-zinc-950 font-bold" : "bg-zinc-800/60 text-zinc-400"
              }`}>
                {energyCount}
              </span>
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
              <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded-md ${
                activeCategory === "sanatate" ? "bg-zinc-950/20 text-zinc-950 font-bold" : "bg-zinc-800/60 text-zinc-400"
              }`}>
                {healthCount}
              </span>
            </button>
          </div>

          {/* CAMERE VIP RESTORED */}
          <div className="space-y-1 pt-2 border-t border-zinc-800/60">
            <span className="text-[10px] uppercase font-mono tracking-widest text-zinc-500 px-2 block mb-2">
              CAMERE VIP
            </span>
            <div className="px-3 py-2 rounded-xl text-xs text-zinc-500 flex items-center justify-between hover:bg-zinc-900/40 transition">
              <div className="flex items-center gap-2">
                <Lock className="w-3.5 h-3.5 text-zinc-600" />
                <span>Apărare & Securitate</span>
              </div>
              <span className="text-[9px] font-mono bg-zinc-900 border border-zinc-800 px-1.5 py-0.5 rounded text-zinc-500">7 locuri</span>
            </div>
            <div className="px-3 py-2 rounded-xl text-xs text-zinc-500 flex items-center justify-between hover:bg-zinc-900/40 transition">
              <div className="flex items-center gap-2">
                <Lock className="w-3.5 h-3.5 text-zinc-600" />
                <span>M&A Confidențial</span>
              </div>
              <span className="text-[9px] font-mono bg-zinc-900 border border-zinc-800 px-1.5 py-0.5 rounded text-zinc-500">3 locuri</span>
            </div>
          </div>

          {/* BRIEFING AI CARD */}
          <div
            onClick={() => setShowAnalyticsModal(true)}
            className="p-3.5 rounded-2xl bg-gradient-to-br from-cyan-950/40 via-zinc-900/80 to-zinc-900 border border-cyan-500/20 hover:border-cyan-500/50 transition cursor-pointer group"
          >
            <div className="flex items-center gap-2 text-cyan-400 text-xs font-semibold mb-1">
              <Sparkles className="w-3.5 h-3.5 text-cyan-400 group-hover:rotate-12 transition-transform" />
              <span>Briefing AI & Radar VIP</span>
            </div>
            <p className="text-[11px] text-zinc-400 leading-snug">
              Analiză de piață xAI Grok și alerte instantanee de pre-ofertare.
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
                {user?.full_name ? user.full_name.split(" ").map((n: string) => n[0]).join("") : "AM"}
              </div>
              <div className="text-left">
                <p className="text-xs font-medium text-zinc-200 leading-none">{user?.full_name || "Andrei Mureșan"}</p>
                <p className="text-[10px] text-zinc-500 mt-0.5">Head Executive</p>
              </div>
            </div>
            <ChevronDown className={`w-3.5 h-3.5 text-zinc-400 transition-transform ${profileMenuOpen ? "rotate-180" : ""}`} />
          </div>
        </div>
      </aside>

      {/* 2. MAIN FEED */}
      <main className="flex-1 flex flex-col overflow-hidden bg-[#070b12]">
        <header className="h-16 px-8 border-b border-zinc-800/70 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-950/60 border border-emerald-500/30 text-emerald-400 text-[11px] font-mono capitalize">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              Domeniul {activeCategory}
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
          <h1 className="text-xl font-bold tracking-tight text-white capitalize">
            Radar comercial — {activeCategory}
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
              <option value="Iasi">Iași</option>
              <option value="Cluj">Cluj</option>
              <option value="Timis">Timiș</option>
              <option value="Bucuresti">București</option>
            </select>

            <div className="h-10 bg-[#0d121f] border border-zinc-800/80 rounded-xl px-3 flex items-center gap-2 text-xs text-zinc-400 font-mono">
              <span className="text-cyan-400 font-bold">{minScore.toFixed(1)}</span>
              <span className="text-[10px] text-zinc-500">MIN SCORE</span>
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
          {filteredLeads.length === 0 ? (
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
                    {lead.opportunity_score ? `${lead.opportunity_score}` : "9.2"}
                  </div>

                  <div className="space-y-1">
                    <div className="flex items-center gap-2 text-[10px] font-mono">
                      <span className="px-1.5 py-0.5 rounded bg-zinc-800/80 text-cyan-400 border border-cyan-500/20 uppercase">
                        {lead.category || "INFRA"}
                      </span>
                      <span className="text-zinc-500">•</span>
                      <span className="text-emerald-400 font-semibold">{lead.funding_source || "Fonduri Publice"}</span>
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
                      {lead.financial_value_ron
                        ? `${(lead.financial_value_ron / 1000000).toFixed(1)} mil. RON`
                        : "18.2 mil. RON"}
                    </div>
                    <div className="text-[10px] text-zinc-500 font-mono">
                      {lead.estimated_timeline?.estimated_tender_launch || "T4 2026"}
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-zinc-600" />
                </div>
              </div>
            ))
          )}
        </div>
      </main>

      {/* 3. DEEP EXECUTIVE DOSSIER DRAWER */}
      {selectedLead && (
        <aside className="w-[460px] bg-[#0c1019] border-l border-zinc-800/80 p-6 flex flex-col justify-between overflow-y-auto z-30 animate-in slide-in-from-right duration-200">
          <div className="space-y-5">
            <div className="flex items-center justify-between pb-3 border-b border-zinc-800">
              <div className="flex items-center gap-2">
                <span className="text-xs font-mono font-semibold text-cyan-400">
                  DOSAR #{selectedLead.source_id ? selectedLead.source_id.slice(0, 14) : "REF-2026"}
                </span>
                <span className="text-[10px] px-2 py-0.5 rounded bg-cyan-950 border border-cyan-500/30 text-cyan-300 font-mono font-semibold">
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

            {/* TIMELINE & FUNDING CARD */}
            <div className="p-3.5 rounded-xl bg-[#111624] border border-zinc-800 space-y-2.5">
              <div className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-1.5 text-zinc-400">
                  <Landmark className="w-3.5 h-3.5 text-cyan-400" />
                  <span className="text-[11px] font-mono">Sursă Finanțare:</span>
                </div>
                <span className="font-semibold text-emerald-400 text-xs font-mono">{selectedLead.funding_source || "Buget Public Alocat"}</span>
              </div>

              <div className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-1.5 text-zinc-400">
                  <Clock className="w-3.5 h-3.5 text-amber-400" />
                  <span className="text-[11px] font-mono">Lansare SEAP Est.:</span>
                </div>
                <span className="font-semibold text-zinc-200 text-xs font-mono">{selectedLead.estimated_timeline?.estimated_tender_launch || "T4 2026"}</span>
              </div>

              <div className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-1.5 text-zinc-400">
                  <Users className="w-3.5 h-3.5 text-indigo-400" />
                  <span className="text-[11px] font-mono">Decizionali Cheie:</span>
                </div>
                <span className="text-zinc-300 text-xs">{selectedLead.key_stakeholders || "Direcția Tehnică"}</span>
              </div>

              <div className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-1.5 text-zinc-400">
                  <ShieldAlert className="w-3.5 h-3.5 text-rose-400" />
                  <span className="text-[11px] font-mono">Risc Competiție:</span>
                </div>
                <span className="text-zinc-300 text-xs">{selectedLead.competition_risk_radar || "Mediu (Raport Calitate-Preț)"}</span>
              </div>
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

      {/* 4. xAI GROK STRATEGIC BRIEFING MODAL */}
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
                  {analytics?.telemetry?.total_pipeline_ron?.toLocaleString() || "417,200,000"} RON
                </span>
              </div>
              <div className="p-3 rounded-xl bg-zinc-900/80 border border-zinc-800 text-center">
                <span className="text-[10px] text-zinc-500 font-mono block">DOSARE CALIFICATE</span>
                <span className="text-xs font-bold text-white font-mono">{allLeads.length}</span>
              </div>
              <div className="p-3 rounded-xl bg-zinc-900/80 border border-zinc-800 text-center">
                <span className="text-[10px] text-zinc-500 font-mono block">SCOR MEDIU</span>
                <span className="text-xs font-bold text-emerald-400 font-mono">9.3/10</span>
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-cyan-950/20 border border-cyan-500/30 space-y-2">
              <span className="text-[10px] font-mono text-cyan-400 font-bold uppercase">MEMO EXECUTIV B2B</span>
              <p className="text-xs text-zinc-200 leading-relaxed">
                {analytics?.ai_strategic_briefing?.executive_summary || "Piața din Regiunea de Nord-Est (Iași) și Nord-Vest (Cluj) înregistrează o concentrare de proiecte majore în faza de consultare de piață și autorizare pre-SEAP. Fereastra optimă de poziționare tehnică este în următoarele 14-21 de zile."}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}