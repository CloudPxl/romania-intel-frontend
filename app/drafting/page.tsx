"use client";
import React, { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { generateTechnicalProposal, generateLegalClarification } from "@/lib/api";

const CATEGORIES = [
  { id: "infrastructura", label: "Infrastructura & Transporturi" },
  { id: "sanatate", label: "Sanatate & Echipamente Medicale" },
  { id: "energie", label: "Energie & Utilitati Verzi" },
  { id: "aparare", label: "Aparare & Securitate Speciala" },
  { id: "digitalizare", label: "Digitalizare, IT & Smart City" }
];

function TechnicalProposalTool({ initial }: { initial: { project_title: string; authority_name: string; county: string; category: string } }) {
  const { activeDesk } = useAuth();
  const [projectTitle, setProjectTitle] = useState(initial.project_title);
  const [authorityName, setAuthorityName] = useState(initial.authority_name);
  const [county, setCounty] = useState(initial.county || "Romania");
  const [category, setCategory] = useState(initial.category || "infrastructura");
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleGenerate = async () => {
    setLoading(true);
    try {
      const res = await generateTechnicalProposal({
        project_title: projectTitle,
        authority_name: authorityName,
        county,
        category,
        company_name: activeDesk?.name || "SC Infra Construct Transilvania SRL",
        cui: activeDesk?.cui || "RO12345678"
      });
      setData(res);
    } catch (err) {
      console.warn(err);
      alert("Eroare la generarea propunerii tehnice.");
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = () => {
    if (data?.dossier_text) {
      navigator.clipboard.writeText(data.dossier_text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="mb-4">
        <h2 className="text-base font-bold text-slate-900">Generator Schita Propunere Tehnica (Legea 98/2016)</h2>
        <p className="text-xs text-slate-500">Structura orientativa pe 4 sectiuni conform standardelor nationale de achizitii.</p>
      </div>

      <div className="grid grid-cols-2 gap-3 text-xs mb-4">
        <div className="col-span-2">
          <label className="block text-slate-600 mb-1">Titlu Proiect</label>
          <input
            type="text"
            value={projectTitle}
            onChange={(e) => setProjectTitle(e.target.value)}
            className="w-full rounded-lg bg-slate-50 border border-slate-300 p-2 text-slate-900 focus:bg-white"
          />
        </div>
        <div>
          <label className="block text-slate-600 mb-1">Autoritate Contractanta</label>
          <input
            type="text"
            value={authorityName}
            onChange={(e) => setAuthorityName(e.target.value)}
            className="w-full rounded-lg bg-slate-50 border border-slate-300 p-2 text-slate-900 focus:bg-white"
          />
        </div>
        <div>
          <label className="block text-slate-600 mb-1">Judet</label>
          <input
            type="text"
            value={county}
            onChange={(e) => setCounty(e.target.value)}
            className="w-full rounded-lg bg-slate-50 border border-slate-300 p-2 text-slate-900 focus:bg-white"
          />
        </div>
        <div className="col-span-2">
          <label className="block text-slate-600 mb-1">Categorie</label>
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="w-full rounded-lg bg-slate-50 border border-slate-300 p-2 text-slate-900 focus:bg-white"
          >
            {CATEGORIES.map((c) => (
              <option key={c.id} value={c.id}>{c.label}</option>
            ))}
          </select>
        </div>
      </div>

      <button onClick={handleGenerate} disabled={loading || !projectTitle} className="w-full rounded-xl bg-slate-900 py-2.5 font-bold text-white text-xs hover:bg-slate-800 transition disabled:opacity-50">
        {loading ? "Se asambleaza structura propunerii tehnice..." : "Genereaza Schita Propunere"}
      </button>

      {data && (
        <div className="mt-4 space-y-3 text-xs">
          <div className="flex justify-between items-center">
            <span className="text-slate-500">Schita generata pentru: <b className="text-slate-800">{data.company_name}</b></span>
            <button
              onClick={handleCopy}
              className="rounded-lg bg-slate-100 border border-slate-200 px-3 py-1.5 font-semibold text-slate-800 hover:bg-slate-200 transition"
            >
              {copied ? "Copiat in Clipboard" : "Copiaza Textul Integral"}
            </button>
          </div>
          <pre className="h-96 overflow-y-auto rounded-xl border border-slate-200 bg-slate-50 p-4 text-xs text-slate-800 whitespace-pre-wrap font-sans leading-relaxed">
            {data.dossier_text}
          </pre>
        </div>
      )}
    </div>
  );
}

function ClarificationLetterTool({ initial }: { initial: { project_title: string; authority_name: string; source_id: string } }) {
  const { activeDesk } = useAuth();
  const [authorityName, setAuthorityName] = useState(initial.authority_name);
  const [projectTitle, setProjectTitle] = useState(initial.project_title);
  const [sourceId, setSourceId] = useState(initial.source_id);
  const [points, setPoints] = useState("1. Solicitam eliminarea cerintei de autorizatie directa de la producator.\n2. Solicitam acceptarea standardelor tehnice europene echivalente conform Art. 160 Legea 98/2016.");
  const [letter, setLetter] = useState("");
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleGenerate = async () => {
    setLoading(true);
    try {
      const data = await generateLegalClarification({
        authority_name: authorityName,
        project_title: projectTitle,
        source_id: sourceId,
        company_name: activeDesk?.name || "SC Infra Construct Transilvania SRL",
        cui_fiscal: activeDesk?.cui || "RO12345678",
        clarification_points: points
      });
      setLetter(data.generated_letter);
    } catch {
      alert("Eroare la generarea adresei oficiale.");
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(letter);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="mb-4">
        <h2 className="text-base font-bold text-slate-900">Generator Solicitare Clarificari (Legea 98/2016)</h2>
        <p className="text-xs text-slate-500">Adresa oficiala de solicitare clarificari / contestare clauze restrictive.</p>
      </div>

      <div className="grid grid-cols-2 gap-3 text-xs mb-3">
        <div>
          <label className="block text-slate-600 mb-1">Autoritate Contractanta</label>
          <input
            type="text"
            value={authorityName}
            onChange={(e) => setAuthorityName(e.target.value)}
            className="w-full rounded-lg bg-slate-50 border border-slate-300 p-2 text-slate-900 focus:bg-white"
          />
        </div>
        <div>
          <label className="block text-slate-600 mb-1">ID Sursa / Anunt</label>
          <input
            type="text"
            value={sourceId}
            onChange={(e) => setSourceId(e.target.value)}
            className="w-full rounded-lg bg-slate-50 border border-slate-300 p-2 text-slate-900 focus:bg-white"
          />
        </div>
        <div className="col-span-2">
          <label className="block text-slate-600 mb-1">Titlu Proiect</label>
          <input
            type="text"
            value={projectTitle}
            onChange={(e) => setProjectTitle(e.target.value)}
            className="w-full rounded-lg bg-slate-50 border border-slate-300 p-2 text-slate-900 focus:bg-white"
          />
        </div>
      </div>

      <label className="block text-xs text-slate-700 mb-1">Puncte de clarificat / Clauze restrictive:</label>
      <textarea
        value={points}
        onChange={(e) => setPoints(e.target.value)}
        className="w-full h-24 rounded-xl border border-slate-300 bg-slate-50 p-2.5 text-xs text-slate-900 mb-3 focus:bg-white focus:outline-none"
      />
      <button onClick={handleGenerate} disabled={loading || !authorityName} className="w-full rounded-xl bg-slate-900 py-2.5 font-bold text-white text-xs hover:bg-slate-800 transition disabled:opacity-50">
        {loading ? "Se redacteaza adresa oficiala..." : "Genereaza Adresa Oficiala"}
      </button>
      {letter && (
        <div className="mt-4">
          <div className="flex justify-between items-center mb-1">
            <span className="text-xs font-bold text-slate-700">Document Generat:</span>
            <button onClick={copyToClipboard} className="rounded bg-slate-100 border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-800 hover:bg-slate-200">
              {copied ? "Copiat" : "Copiaza Textul"}
            </button>
          </div>
          <pre className="h-48 overflow-y-auto rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs text-slate-800 whitespace-pre-wrap font-sans">
            {letter}
          </pre>
        </div>
      )}
    </div>
  );
}

function DraftingContent() {
  const searchParams = useSearchParams();
  const initialTool = searchParams.get("tool") === "clarification" ? "clarification" : "proposal";
  const [activeTool, setActiveTool] = useState<"proposal" | "clarification">(initialTool);

  const initial = {
    project_title: searchParams.get("project_title") || "",
    authority_name: searchParams.get("authority_name") || "",
    county: searchParams.get("county") || "",
    category: searchParams.get("category") || "",
    source_id: searchParams.get("source_id") || "",
  };

  return (
    <main className="flex-1 p-6 overflow-y-auto">
      <div className="max-w-3xl mx-auto">
        <div className="mb-4 flex items-center gap-2">
          <button
            onClick={() => setActiveTool("proposal")}
            className={"rounded-lg px-3.5 py-1.5 text-xs font-semibold transition " + (activeTool === "proposal" ? "bg-slate-900 text-white" : "bg-white border border-slate-300 text-slate-700 hover:bg-slate-50")}
          >
            Propunere Tehnica
          </button>
          <button
            onClick={() => setActiveTool("clarification")}
            className={"rounded-lg px-3.5 py-1.5 text-xs font-semibold transition " + (activeTool === "clarification" ? "bg-slate-900 text-white" : "bg-white border border-slate-300 text-slate-700 hover:bg-slate-50")}
          >
            Adresa Legea 544 / Clarificari
          </button>
        </div>

        {activeTool === "proposal" ? (
          <TechnicalProposalTool initial={initial} />
        ) : (
          <ClarificationLetterTool initial={initial} />
        )}
      </div>
    </main>
  );
}

export default function DraftingPage() {
  return (
    <Suspense fallback={<main className="flex-1 p-6 text-xs text-slate-500">Se incarca...</main>}>
      <DraftingContent />
    </Suspense>
  );
}
