"use client";
import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/context/AuthContext";
import { fetchMarketTrends } from "@/lib/api";

function formatRon(value: number): string {
  if (!value) return "0 RON";
  if (value >= 1_000_000_000) return `${(value / 1_000_000_000).toFixed(2)} Mld. RON`;
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(2)} Mil. RON`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)} Mii RON`;
  return `${value.toFixed(0)} RON`;
}

const TOOLS = [
  { href: "/newsletter", title: "Newsletter", desc: "Fluxul zilnic de oportunitati pre-SEAP filtrate pe linia dvs. de produse." },
  { href: "/eligibility", title: "Eligibilitate Finantari", desc: "Scanare rapida a eligibilitatii companiei pentru fonduri si programe active." },
  { href: "/drafting", title: "Generare Documente", desc: "Propuneri tehnice si adrese de clarificare Legea 544, generate automat." },
  { href: "/analytics", title: "Analiza & Strategie", desc: "Copilot AI, radar concurenta, scanare caiet de sarcini, simulare sanse de castig." },
  { href: "/analysis", title: "Analiza de Piata", desc: "Tendinte cantitative: valoare piata, distributie pe judet si domeniu." },
  { href: "/pipeline", title: "Pipeline", desc: "Stadiul intern al dosarelor aflate in lucru: evaluare, clarificari, marje." },
];

export default function HomePage() {
  const { user, activeDesk } = useAuth();
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    fetchMarketTrends()
      .then((d) => mounted && setStats(d))
      .catch(() => mounted && setStats(null))
      .finally(() => mounted && setLoading(false));
    return () => {
      mounted = false;
    };
  }, []);

  const firstName = user?.full_name ? user.full_name.split(" ")[0] : null;

  return (
    <main className="flex-1 p-6 overflow-y-auto bg-slate-50">
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <p className="text-[11px] uppercase font-bold text-brand-700 tracking-wide">
            {activeDesk?.name || "RO-INTEL"}
          </p>
          <h1 className="text-xl font-bold text-slate-900 mt-1">
            {firstName ? `Bine ai revenit, ${firstName}.` : "Bine ai venit in RO-INTEL."}
          </h1>
          <p className="text-xs text-slate-500 mt-1 max-w-2xl">
            Aici gasiti pe scurt starea pietei si acces rapid la toate uneltele. Pentru fluxul complet de oportunitati, mergeti direct la Newsletter.
          </p>
          <Link
            href="/newsletter"
            className="inline-block mt-4 rounded-lg bg-slate-900 px-4 py-2 text-xs font-bold text-white hover:bg-slate-800 transition shadow-sm"
          >
            Deschide Newsletter &rarr;
          </Link>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <span className="text-[10px] uppercase font-bold text-slate-400">Dosare Active</span>
            <p className="text-2xl font-extrabold text-slate-900 mt-1">
              {loading ? "..." : stats?.total_leads ?? 0}
            </p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <span className="text-[10px] uppercase font-bold text-slate-400">Valoare Totala Piata</span>
            <p className="text-2xl font-extrabold text-slate-900 mt-1">
              {loading ? "..." : formatRon(stats?.total_market_value_ron || 0)}
            </p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <span className="text-[10px] uppercase font-bold text-slate-400">Scor Mediu Oportunitate</span>
            <p className="text-2xl font-extrabold text-slate-900 mt-1">
              {loading ? "..." : stats?.average_opportunity_score ?? "-"}
            </p>
          </div>
        </div>

        <div>
          <h2 className="text-xs font-bold text-slate-800 uppercase mb-3">Unelte Disponibile</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {TOOLS.map((tool) => (
              <Link
                key={tool.href}
                href={tool.href}
                className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm hover:border-brand-300 hover:shadow-md transition block"
              >
                <h3 className="text-sm font-bold text-slate-900">{tool.title}</h3>
                <p className="text-[11px] text-slate-500 mt-1">{tool.desc}</p>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </main>
  );
}
