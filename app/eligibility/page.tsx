"use client";
import React, { useState, useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import { evaluateBusinessEligibility } from "@/lib/api";

export default function EligibilityPage() {
  const { activeDesk } = useAuth();
  const [companyName, setCompanyName] = useState(activeDesk?.name || "SC Infra Construct Transilvania SRL");
  const [cui, setCui] = useState(activeDesk?.cui || "RO12345678");
  const [caen, setCaen] = useState("4211");
  const [turnover, setTurnover] = useState(18500000);
  const [employees, setEmployees] = useState(48);
  const [county, setCounty] = useState(activeDesk?.target_counties?.[0] || "Cluj");
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (activeDesk) {
      setCompanyName(activeDesk.name);
      setCui(activeDesk.cui);
      if (activeDesk.target_counties?.length > 0) setCounty(activeDesk.target_counties[0]);
    }
  }, [activeDesk]);

  const handleScan = async () => {
    setLoading(true);
    try {
      const data = await evaluateBusinessEligibility({
        company_name: companyName,
        cui_fiscal: cui,
        caen_code: caen,
        turnover_ron: Number(turnover),
        employee_count: Number(employees),
        county
      });
      setResult(data);
    } catch (e: any) {
      alert("Eroare la scanare: " + (e?.message || "Verificati conexiunea cu serverul API."));
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="flex-1 p-6 overflow-y-auto">
      <div className="max-w-3xl mx-auto">
        <div className="mb-4">
          <h1 className="text-lg font-bold text-slate-900">Scanner Eligibilitate Granturi & Licitatii Strategice</h1>
          <p className="text-xs text-slate-500">Evaluare automata a profilului companiei conform ghidurilor PNRR / MIPE 2026.</p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="grid grid-cols-2 gap-3 text-xs mb-4">
            <div>
              <label className="block text-slate-600 mb-1">Nume Companie</label>
              <input
                type="text"
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                className="w-full rounded-lg bg-slate-50 border border-slate-300 p-2 text-slate-900 focus:bg-white"
              />
            </div>
            <div>
              <label className="block text-slate-600 mb-1">CUI / Cod Fiscal</label>
              <input
                type="text"
                value={cui}
                onChange={(e) => setCui(e.target.value)}
                className="w-full rounded-lg bg-slate-50 border border-slate-300 p-2 text-slate-900 focus:bg-white"
              />
            </div>
            <div>
              <label className="block text-slate-600 mb-1">Cod CAEN Principal</label>
              <input
                type="text"
                value={caen}
                onChange={(e) => setCaen(e.target.value)}
                className="w-full rounded-lg bg-slate-50 border border-slate-300 p-2 text-slate-900 focus:bg-white"
              />
            </div>
            <div>
              <label className="block text-slate-600 mb-1">Cifra de Afaceri Anuala (RON)</label>
              <input
                type="number"
                value={turnover}
                onChange={(e) => setTurnover(Number(e.target.value))}
                className="w-full rounded-lg bg-slate-50 border border-slate-300 p-2 text-slate-900 focus:bg-white"
              />
            </div>
            <div>
              <label className="block text-slate-600 mb-1">Numar Angajati</label>
              <input
                type="number"
                value={employees}
                onChange={(e) => setEmployees(Number(e.target.value))}
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
          </div>

          <button onClick={handleScan} disabled={loading} className="w-full rounded-xl bg-slate-900 py-2.5 font-bold text-white hover:bg-slate-800 transition">
            {loading ? "Se verifica criteriile de eligibilitate..." : "Evalueaza Profilul Companiei"}
          </button>

          {result && (
            <div className="mt-4 space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-4 text-xs">
              <div className="flex justify-between items-center border-b border-slate-200 pb-2">
                <span className="font-bold text-slate-800">{result.qualification_status}</span>
                <span className="rounded bg-emerald-100 px-2 py-0.5 font-bold text-emerald-800">Scor: {result.overall_eligibility_score}/10</span>
              </div>
              <p className="text-slate-600 leading-relaxed">{result.advisory_summary}</p>
              <div className="space-y-2 mt-2">
                <span className="font-bold text-slate-500 uppercase text-[10px]">Linii de Finantare Eligibile:</span>
                {result.matched_grants && result.matched_grants.map((g: any, i: number) => (
                  <div key={i} className="rounded bg-white p-3 border-l-2 border-brand-600 shadow-sm">
                    <div className="flex justify-between">
                      <span className="font-bold text-slate-900">{g.program_name}</span>
                      <span className="font-bold text-emerald-700">Pana la {g.eligible_grant_up_to}</span>
                    </div>
                    <p className="text-slate-500 text-[11px] mt-1">Cofinantare: {g.required_co_financing} | Baza legala: {g.legal_basis}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
