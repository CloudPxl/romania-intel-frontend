"use client";
import React, { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import {
  fetch72hMarketReport,
  askCopilotChat,
  fetchCompetitorAnalysis,
  analyzeCaietSarcini,
  uploadCaietFile,
  predictWinRate,
} from "@/lib/api";

const CATEGORIES = [
  { id: "infrastructura", label: "Infrastructura & Transporturi" },
  { id: "sanatate", label: "Sanatate & Echipamente Medicale" },
  { id: "energie", label: "Energie & Utilitati Verzi" },
  { id: "aparare", label: "Aparare & Securitate Speciala" },
  { id: "digitalizare", label: "Digitalizare, IT & Smart City" }
];

function CopilotAnalysisTool() {
  const { activeDesk } = useAuth();
  const tenantId = activeDesk?.id || "desk_default";
  const [report72h, setReport72h] = useState<any>(null);
  const [messages, setMessages] = useState<{ sender: "user" | "ai"; text: string }[]>([
    { sender: "ai", text: "Buna ziua! Sunt Copilotul AI RO-INTEL. Cu ce oportunitate, cerinta de calificare sau strategie de licitatie doriti sa incepem?" }
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetch72hMarketReport(tenantId).then(setReport72h).catch(err => console.warn("[Analytics] 72h report note:", err));
  }, [tenantId]);

  const handleSend = async () => {
    if (!input.trim() || loading) return;
    const userQ = input;
    setInput("");
    setMessages(prev => [...prev, { sender: "user", text: userQ }]);
    setLoading(true);
    try {
      const data = await askCopilotChat(userQ, tenantId);
      setMessages(prev => [...prev, { sender: "ai", text: data.reply }]);
    } catch (e: any) {
      setMessages(prev => [...prev, { sender: "ai", text: "Eroare la conexiunea cu Copilotul AI: " + (e?.message || "") }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm flex flex-col h-[70vh]">
      <div className="mb-3 border-b border-slate-100 pb-3">
        <h2 className="text-base font-bold text-slate-900">Copilot AI Bidding & Radar 72h</h2>
        <p className="text-xs text-slate-500">{report72h?.period || "Ultimele 72 ore"}</p>
      </div>

      {report72h && (
        <div className="rounded-xl bg-slate-50 p-3 text-xs mb-3 border border-slate-200 space-y-1">
          <span className="font-bold text-slate-700 block">Sinteza Macro Ultimele 72h:</span>
          <ul className="list-disc pl-4 text-slate-600 space-y-0.5">
            {report72h.executive_takeaways && report72h.executive_takeaways.map((t: string, i: number) => <li key={i}>{t}</li>)}
          </ul>
        </div>
      )}

      <div className="flex-1 overflow-y-auto space-y-3 p-2 text-xs">
        {messages.map((m, i) => (
          <div key={i} className={"flex " + (m.sender === "user" ? "justify-end" : "justify-start")}>
            <div className={"max-w-[85%] rounded-xl p-3 " + (m.sender === "user" ? "bg-slate-900 text-white font-medium" : "bg-slate-100 border border-slate-200 text-slate-800")}>
              {m.text}
            </div>
          </div>
        ))}
        {loading && <div className="text-slate-500 text-xs animate-pulse">Copilotul AI analizeaza dosarele pre-SEAP...</div>}
      </div>

      <div className="flex gap-2 mt-3 pt-2 border-t border-slate-100">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSend()}
          placeholder="Intrebati despre cerinte de atribuire, licitatii CNI, bugete sau contestatii..."
          className="flex-1 rounded-xl border border-slate-300 bg-slate-50 px-3 py-2 text-xs text-slate-900 focus:bg-white focus:outline-none focus:border-brand-500"
        />
        <button onClick={handleSend} disabled={loading} className="rounded-xl bg-slate-900 px-4 py-2 font-bold text-white text-xs hover:bg-slate-800">
          Trimite
        </button>
      </div>
    </div>
  );
}

function CompetitorRadarTool({ initial }: { initial: { category: string; county: string; budget: string } }) {
  const [category, setCategory] = useState(initial.category || "infrastructura");
  const [county, setCounty] = useState(initial.county || "");
  const [budget, setBudget] = useState(initial.budget ? Number(initial.budget) : 10000000);
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const handleAnalyze = async () => {
    setLoading(true);
    try {
      const res = await fetchCompetitorAnalysis(category, county, budget);
      setData(res);
    } catch (err) {
      console.warn(err);
      alert("Eroare la analiza concurentei.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="mb-4">
        <h2 className="text-base font-bold text-slate-900">Radar Concurenta & Profil Piata Regionala</h2>
        <p className="text-xs text-slate-500">Analiza istorica a preturilor de adjudecare si a riscului de contestatie.</p>
      </div>

      <div className="grid grid-cols-3 gap-3 text-xs mb-4">
        <div>
          <label className="block text-slate-600 mb-1">Categorie</label>
          <select value={category} onChange={(e) => setCategory(e.target.value)} className="w-full rounded-lg bg-slate-50 border border-slate-300 p-2 text-slate-900 focus:bg-white">
            {CATEGORIES.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-slate-600 mb-1">Judet</label>
          <input type="text" value={county} onChange={(e) => setCounty(e.target.value)} className="w-full rounded-lg bg-slate-50 border border-slate-300 p-2 text-slate-900 focus:bg-white" />
        </div>
        <div>
          <label className="block text-slate-600 mb-1">Buget Estimat (RON)</label>
          <input type="number" value={budget} onChange={(e) => setBudget(Number(e.target.value))} className="w-full rounded-lg bg-slate-50 border border-slate-300 p-2 text-slate-900 focus:bg-white" />
        </div>
      </div>

      <button onClick={handleAnalyze} disabled={loading || !county} className="w-full rounded-xl bg-slate-900 py-2.5 font-bold text-white text-xs hover:bg-slate-800 transition disabled:opacity-50">
        {loading ? "Se proceseaza curbele de discount..." : "Analizeaza Concurenta"}
      </button>

      {data && (
        <div className="mt-4 space-y-4 text-xs">
          <div className="grid grid-cols-3 gap-3">
            <div className="rounded-xl bg-slate-50 p-3 border border-slate-200">
              <span className="text-[10px] text-slate-500 block uppercase font-bold">Discount Istoric Mediu</span>
              <span className="text-base font-extrabold text-slate-900">{data.benchmark?.historical_avg_discount}</span>
            </div>
            <div className="rounded-xl bg-slate-50 p-3 border border-slate-200">
              <span className="text-[10px] text-slate-500 block uppercase font-bold">Risc Subcotare</span>
              <span className="text-base font-bold text-amber-700">{data.benchmark?.undercutting_risk}</span>
            </div>
            <div className="rounded-xl bg-slate-50 p-3 border border-slate-200">
              <span className="text-[10px] text-slate-500 block uppercase font-bold">Rata Contestatii CNSC</span>
              <span className="text-base font-bold text-rose-700">{data.benchmark?.cnsc_dispute_frequency}</span>
            </div>
          </div>

          <div className="rounded-xl bg-slate-50 border border-slate-200 p-4 space-y-2">
            <span className="font-bold text-slate-800 block">Jucatori Frecventi Identificati in {data.sector}:</span>
            <ul className="list-disc pl-4 text-slate-600 space-y-1">
              {data.benchmark?.identified_key_competitors?.map((c: string, i: number) => <li key={i}>{c}</li>)}
            </ul>
          </div>

          <div className="rounded-xl bg-brand-50 border border-brand-200 p-4 space-y-2">
            <span className="font-bold text-brand-900 block">Recomandare Pozitionare Financiara:</span>
            <div className="grid grid-cols-3 gap-2">
              <div className="bg-white p-2 rounded border border-brand-100">
                <span className="text-[10px] text-slate-400 block font-semibold">Oferta Sigura</span>
                <span className="font-bold text-slate-800">{(data.pricing_recommendations?.safe_margin_bid_ron / 1000000).toFixed(2)} Mil. RON</span>
              </div>
              <div className="bg-white p-2 rounded border border-brand-200 shadow-sm">
                <span className="text-[10px] text-brand-700 block font-bold">Optim Competitiv</span>
                <span className="font-extrabold text-brand-900">{(data.pricing_recommendations?.optimal_competitive_bid_ron / 1000000).toFixed(2)} Mil. RON</span>
              </div>
              <div className="bg-white p-2 rounded border border-brand-100">
                <span className="text-[10px] text-slate-400 block font-semibold">Limita Agresiva</span>
                <span className="font-bold text-slate-800">{(data.pricing_recommendations?.aggressive_limit_bid_ron / 1000000).toFixed(2)} Mil. RON</span>
              </div>
            </div>
            <p className="text-slate-600 text-[11px] mt-2">{data.benchmark?.tactical_guidance}</p>
          </div>
        </div>
      )}
    </div>
  );
}

function CaietScannerTool({ initial }: { initial: { project_title: string } }) {
  const [projectTitle, setProjectTitle] = useState(initial.project_title || "");
  const [text, setText] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const handleAnalyze = async () => {
    setLoading(true);
    try {
      if (file) {
        const data = await uploadCaietFile(file, projectTitle);
        setResult(data);
      } else if (text.trim()) {
        const data = await analyzeCaietSarcini(projectTitle, text);
        setResult(data);
      }
    } catch (e: any) {
      alert("Eroare: " + (e?.message || "Nu s-a putut analiza caietul de sarcini."));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="mb-4">
        <h2 className="text-base font-bold text-slate-900">Scanner Clauze Restrictive (Caiet de Sarcini)</h2>
        <p className="text-xs text-slate-500">Detectarea automata a clauzelor restrictive conform jurisprudentei CNSC.</p>
      </div>

      <label className="block text-slate-600 mb-1 text-xs">Titlu Proiect</label>
      <input
        type="text"
        value={projectTitle}
        onChange={(e) => setProjectTitle(e.target.value)}
        placeholder="Titlul proiectului analizat..."
        className="w-full rounded-lg bg-slate-50 border border-slate-300 p-2 text-xs text-slate-900 focus:bg-white mb-3"
      />

      <div className="rounded-xl border-2 border-dashed border-slate-300 bg-slate-50 p-4 text-center mb-3">
        <input type="file" accept=".pdf,.docx,.txt" onChange={(e) => setFile(e.target.files?.[0] || null)} className="hidden" id="caiet-upload" />
        <label htmlFor="caiet-upload" className="cursor-pointer block">
          <span className="text-brand-700 font-bold block text-xs">
            {file ? "Fisier selectat: " + file.name : "Incarcati fisierul PDF sau DOCX aici (sau click pentru a alege)"}
          </span>
          <span className="text-[10px] text-slate-500 mt-1 block">Suporta Caiete de Sarcini oficiale PDF, DOCX</span>
        </label>
      </div>

      <div className="text-center text-[10px] text-slate-400 mb-2 font-bold uppercase">Sau introduceti textul direct</div>

      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Introduceti textul din caietul de sarcini..."
        className="w-full h-24 rounded-xl border border-slate-300 bg-slate-50 p-3 text-xs text-slate-900 focus:bg-white focus:border-brand-500 focus:outline-none"
      />

      <button
        onClick={handleAnalyze}
        disabled={loading || (!text && !file) || !projectTitle}
        className="mt-3 w-full rounded-xl bg-slate-900 py-2.5 font-bold text-white text-xs hover:bg-slate-800 transition disabled:opacity-50"
      >
        {loading ? "Se analizeaza documentul conform jurisprudentei CNSC..." : "Scaneaza Clauze Restrictive"}
      </button>

      {result && (
        <div className="mt-4 space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-4 text-xs">
          <div className="flex justify-between items-center">
            <span className="font-semibold text-slate-700">Nivel Risc Restrictiv:</span>
            <span className="font-bold text-amber-800">{result.bias_risk_level} (Scor: {result.bias_score}/10)</span>
          </div>
          <p className="text-slate-600">{result.recommended_action}</p>
          <div className="space-y-2 mt-2">
            <span className="font-bold text-slate-500 uppercase text-[10px]">Clauze Identificate:</span>
            {result.detected_red_flags && result.detected_red_flags.map((flag: any, i: number) => (
              <div key={i} className="rounded bg-white p-2.5 border-l-2 border-amber-500 shadow-sm">
                <p className="font-bold text-slate-900">{flag.pattern} — Risc {flag.severity}</p>
                <p className="text-slate-600 mt-0.5">{flag.tactical_advisory}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function WinOddsTool({ initial }: { initial: { budget: string } }) {
  const defaultBudget = initial.budget ? Number(initial.budget) : 10000000;
  const [budget, setBudget] = useState(defaultBudget);
  const [price, setPrice] = useState(Math.round(defaultBudget * 0.92));
  const [hasPartner, setHasPartner] = useState(true);
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const handleCalculate = async () => {
    setLoading(true);
    try {
      const data = await predictWinRate(budget, price, hasPartner);
      setResult(data);
    } catch {
      alert("Eroare la calcularea sanselor.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm max-w-xl">
      <div className="mb-4">
        <h2 className="text-base font-bold text-slate-900">Simulator Sanse de Castig & Marja Optima</h2>
      </div>
      <div className="space-y-3 text-xs">
        <div>
          <label className="block text-slate-600 mb-1">Buget Estimat Autoritate Contractanta (RON)</label>
          <input type="number" value={budget} onChange={(e) => setBudget(Number(e.target.value))} className="w-full rounded-xl border border-slate-300 bg-slate-50 p-2.5 text-slate-900" />
        </div>
        <div>
          <label className="block text-slate-600 mb-1">Pret Ofertat Propus (RON)</label>
          <input type="number" value={price} onChange={(e) => setPrice(Number(e.target.value))} className="w-full rounded-xl border border-slate-300 bg-slate-50 p-2.5 text-slate-900" />
        </div>
        <label className="flex items-center gap-2 text-slate-700">
          <input type="checkbox" checked={hasPartner} onChange={(e) => setHasPartner(e.target.checked)} className="rounded" />
          Consortiu / Subcontractant local in judetul autoritatii (+12% logistica)
        </label>
        <button onClick={handleCalculate} disabled={loading} className="w-full rounded-xl bg-slate-900 py-2.5 font-bold text-white text-xs hover:bg-slate-800 transition">
          {loading ? "Se evalueaza..." : "Calculeaza Probabilitate Castig"}
        </button>
        {result && (
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-center mt-3">
            <p className="uppercase text-slate-500 text-[10px] font-bold">Probabilitate Estimata de Atribuire</p>
            <p className="text-3xl font-extrabold text-emerald-700 my-1">{result.win_probability_score}</p>
            <p className="text-slate-700">Discount propus: <span className="font-bold text-slate-900">{result.discount_percentage}</span> ({result.rating})</p>
            <p className="text-slate-600 mt-2 text-left bg-white p-2.5 rounded border border-slate-200 text-[11px]">{result.tactical_guidance}</p>
          </div>
        )}
      </div>
    </div>
  );
}

const TOOLS = [
  { id: "copilot", label: "Copilot AI & Radar 72h" },
  { id: "competitor", label: "Radar Concurenta" },
  { id: "caiet", label: "Scanner Caiet Sarcini" },
  { id: "win", label: "Simulator Sanse Castig" },
] as const;

type ToolId = typeof TOOLS[number]["id"];

function AnalyticsContent() {
  const searchParams = useSearchParams();
  const requestedTool = searchParams.get("tool") as ToolId | null;
  const [activeTool, setActiveTool] = useState<ToolId>(requestedTool && TOOLS.some(t => t.id === requestedTool) ? requestedTool : "copilot");

  const initial = {
    category: searchParams.get("category") || "",
    county: searchParams.get("county") || "",
    budget: searchParams.get("budget") || "",
    project_title: searchParams.get("project_title") || "",
  };

  return (
    <main className="flex-1 p-6 overflow-y-auto">
      <div className="max-w-3xl mx-auto">
        <div className="mb-4 flex flex-wrap items-center gap-2">
          {TOOLS.map((t) => (
            <button
              key={t.id}
              onClick={() => setActiveTool(t.id)}
              className={"rounded-lg px-3.5 py-1.5 text-xs font-semibold transition " + (activeTool === t.id ? "bg-slate-900 text-white" : "bg-white border border-slate-300 text-slate-700 hover:bg-slate-50")}
            >
              {t.label}
            </button>
          ))}
        </div>

        {activeTool === "copilot" && <CopilotAnalysisTool />}
        {activeTool === "competitor" && <CompetitorRadarTool initial={initial} />}
        {activeTool === "caiet" && <CaietScannerTool initial={initial} />}
        {activeTool === "win" && <WinOddsTool initial={initial} />}
      </div>
    </main>
  );
}

export default function AnalyticsPage() {
  return (
    <Suspense fallback={<main className="flex-1 p-6 text-xs text-slate-500">Se incarca...</main>}>
      <AnalyticsContent />
    </Suspense>
  );
}
