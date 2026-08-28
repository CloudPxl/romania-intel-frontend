"use client";
import React, { useEffect, useState } from "react";
import Link from "next/link";
import { fetchMarketTrends } from "@/lib/api";

function formatRon(value: number): string {
  if (!value) return "0 RON";
  if (value >= 1_000_000_000) return `${(value / 1_000_000_000).toFixed(2)} Mld. RON`;
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(2)} Mil. RON`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)} Mii RON`;
  return `${value.toFixed(0)} RON`;
}

function BarRow({ label, count, value, maxValue, accent = "bg-brand-600" }: { label: string; count: number; value: number; maxValue: number; accent?: string }) {
  const pct = maxValue > 0 ? Math.max(4, Math.round((value / maxValue) * 100)) : 0;
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-[11px]">
        <span className="font-semibold text-slate-800 truncate pr-2">{label}</span>
        <span className="text-slate-500 whitespace-nowrap">{count} dosare &middot; {formatRon(value)}</span>
      </div>
      <div className="h-2 w-full rounded-full bg-slate-100 overflow-hidden">
        <div className={`h-full rounded-full ${accent}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

export default function AnalysisPage() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await fetchMarketTrends();
      setData(result);
    } catch (e: any) {
      setError(e?.message || "Eroare la incarcarea analizei de piata");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const maxCounty = data?.by_county?.length ? Math.max(...data.by_county.map((c: any) => c.value_ron)) : 0;
  const maxCategory = data?.by_category?.length ? Math.max(...data.by_category.map((c: any) => c.value_ron)) : 0;
  const maxFunding = data?.by_funding_source?.length ? Math.max(...data.by_funding_source.map((c: any) => c.value_ron)) : 0;

  return (
    <main className="flex-1 p-6 overflow-y-auto bg-slate-50">
      <div className="max-w-6xl mx-auto space-y-5">
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-lg font-bold text-slate-900">Analiza de Piata</h1>
            <p className="text-xs text-slate-500">Tendinte cantitative extrase din buletinul curent de oportunitati pre-SEAP.</p>
          </div>
          <button
            onClick={() => load()}
            disabled={loading}
            className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition shadow-sm"
          >
            {loading ? "Se actualizeaza..." : "Reincarca"}
          </button>
        </div>

        {error && (
          <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-xs text-rose-700">{error}</div>
        )}

        {loading ? (
          <div className="flex h-48 items-center justify-center text-xs text-slate-500">Se incarca analiza de piata...</div>
        ) : !data || data.total_leads === 0 ? (
          <div className="rounded-2xl border border-slate-200 bg-white p-6 flex flex-col items-center justify-center text-xs text-slate-500 space-y-1 h-48">
            <span>Nu exista inca date suficiente in buletin pentru analiza de piata.</span>
            <span className="text-[11px] text-brand-700">Datele apar automat dupa primul ciclu de scanare (la fiecare 6 ore).</span>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                <span className="text-[10px] uppercase font-bold text-slate-400">Total Dosare Active</span>
                <p className="text-2xl font-extrabold text-slate-900 mt-1">{data.total_leads}</p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                <span className="text-[10px] uppercase font-bold text-slate-400">Valoare Totala Piata</span>
                <p className="text-2xl font-extrabold text-slate-900 mt-1">{formatRon(data.total_market_value_ron)}</p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                <span className="text-[10px] uppercase font-bold text-slate-400">Scor Mediu Oportunitate</span>
                <p className="text-2xl font-extrabold text-slate-900 mt-1">{data.average_opportunity_score ?? "-"}</p>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm space-y-3">
                <h2 className="text-xs font-bold text-slate-800 uppercase">Distributie pe Domeniu</h2>
                <div className="space-y-3">
                  {data.by_category.map((c: any) => (
                    <BarRow key={c.category} label={c.category} count={c.count} value={c.value_ron} maxValue={maxCategory} accent="bg-brand-600" />
                  ))}
                </div>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm space-y-3">
                <h2 className="text-xs font-bold text-slate-800 uppercase">Top Judete dupa Valoare</h2>
                <div className="space-y-3">
                  {data.by_county.slice(0, 8).map((c: any) => (
                    <BarRow key={c.county} label={c.county} count={c.count} value={c.value_ron} maxValue={maxCounty} accent="bg-emerald-600" />
                  ))}
                </div>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm space-y-3">
                <h2 className="text-xs font-bold text-slate-800 uppercase">Surse de Finantare</h2>
                <div className="space-y-3">
                  {data.by_funding_source.map((f: any) => (
                    <BarRow key={f.funding_source} label={f.funding_source} count={f.count} value={f.value_ron} maxValue={maxFunding} accent="bg-amber-600" />
                  ))}
                </div>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <h2 className="text-xs font-bold text-slate-800 uppercase mb-3">Top 10 Oportunitati dupa Valoare</h2>
                <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
                  {data.top_opportunities.map((o: any, i: number) => (
                    <div key={i} className="rounded-lg border border-slate-100 bg-slate-50 p-2.5 text-[11px] flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <p className="font-bold text-slate-900 truncate">{o.project_title}</p>
                        <p className="text-slate-500 truncate">{o.entity_name} &middot; {o.county}</p>
                      </div>
                      <span className="font-extrabold text-slate-900 whitespace-nowrap">{formatRon(o.financial_value_ron)}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="text-center">
              <Link href="/newsletter" className="text-xs font-semibold text-brand-700 hover:underline">
                Vezi toate dosarele in Newsletter &rarr;
              </Link>
            </div>
          </>
        )}
      </div>
    </main>
  );
}
