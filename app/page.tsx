"use client";
import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/context/AuthContext";
import { fetchMarketTrends, type MarketTrends } from "@/lib/api";
import { formatDateline, formatLeadValue, formatNumber, formatRon } from "@/lib/format";
import { ButtonLink, DegradedBanner, Eyebrow, Ornament, StatCell } from "@/components/newsprint";

const SECTIONS = [
  {
    href: "/newsletter",
    kicker: "Registrul zilnic",
    title: "Oportunități pre-SEAP, filtrate pe linia dvs. de produse",
    body: "Fluxul complet de semnale calificate din registrele publice, cu dosar strategic pentru fiecare poziție și salvare directă în pipeline.",
  },
  {
    href: "/analysis",
    kicker: "Analiza de piață",
    title: "Unde se concentrează bugetul public, în cifre",
    body: "Distribuție pe județ, domeniu și sursă de finanțare, recalculată la fiecare interogare din datele curente.",
  },
  {
    href: "/eligibility",
    kicker: "Eligibilitate",
    title: "Verificarea profilului înainte de a angaja resurse",
    body: "Motivele de excludere obligatorii din Legea 98/2016 și liniile de finanțare pentru care compania se califică.",
  },
  {
    href: "/drafting",
    kicker: "Redactare",
    title: "Propuneri tehnice și solicitări de clarificare",
    body: "Documente structurate conform legislației naționale, exportabile direct în format .docx.",
  },
  {
    href: "/analytics",
    kicker: "Strategie",
    title: "Copilot, radar concurență și scanner caiet de sarcini",
    body: "Analiza clauzelor restrictive, profilul pieței observate și poziționarea financiară față de valoarea estimată.",
  },
  {
    href: "/pipeline",
    kicker: "Ofertare",
    title: "Stadiul real al dosarelor aflate în lucru",
    body: "Valoare ponderată pe etapă, timp mediu petrecut în fiecare fază și rate de conversie din istoricul propriu.",
  },
];

export default function HomePage() {
  const { user, activeDesk } = useAuth();
  const [stats, setStats] = useState<MarketTrends | null>(null);
  const [loading, setLoading] = useState(true);
  const [dateline, setDateline] = useState("");

  useEffect(() => setDateline(formatDateline()), []);

  useEffect(() => {
    let mounted = true;
    fetchMarketTrends()
      .then((d) => mounted && setStats(d))
      .catch(() => mounted && setStats(null))
      .finally(() => mounted && setLoading(false));
    return () => {
      mounted = false;
    };
  }, [user]);

  const firstName = user?.full_name?.split(" ")[0];
  const leadStory = stats?.top_opportunities?.[0];
  const topCounty = stats?.by_county?.[0];
  const topCategory = stats?.by_category?.[0];

  return (
    <main className="mx-auto w-full max-w-screen-xl flex-1 px-4 py-6 sm:py-10">
      {stats?.degraded && <DegradedBanner detail={stats.detail} />}

      {/* Masthead */}
      <div className="border-b-4 border-ink pb-6 text-center">
        <Eyebrow className="text-editorial">Intelligence achiziții publice · România</Eyebrow>
        <h1 className="font-display mt-3 text-5xl font-black leading-[0.88] tracking-tighter sm:text-7xl lg:text-8xl">
          Registrul Oportunităților Publice
        </h1>
        <p className="font-mono mt-4 text-[11px] uppercase tracking-[0.2em] text-stock-500">
          {dateline || " "} · Ediție națională
        </p>
      </div>

      {/* Live figures ticker */}
      <div className="rule-grid grid grid-cols-2 border-x border-b border-ink lg:grid-cols-4">
        <StatCell label="Dosare în registru" value={formatNumber(stats?.total_leads ?? 0)} loading={loading} />
        <StatCell
          label="Valoare totală piață"
          value={formatRon(stats?.total_market_value_ron)}
          loading={loading}
          hint={topCategory ? `Domeniu dominant: ${topCategory.category}` : undefined}
        />
        <StatCell
          label="Scor mediu oportunitate"
          value={stats?.average_opportunity_score != null ? `${stats.average_opportunity_score} / 10` : "—"}
          loading={loading}
        />
        <StatCell
          label="Județ cu volum maxim"
          value={topCounty?.county ?? "—"}
          loading={loading}
          hint={topCounty ? formatRon(topCounty.value_ron) : undefined}
          // The trailing cell closes the row, so it drops its vertical rule.
        />
      </div>

      {/* Lead article */}
      <section className="grid grid-cols-1 gap-0 border-x border-b border-ink lg:grid-cols-12">
        <div className="border-b border-ink p-5 sm:p-8 lg:col-span-8 lg:border-b-0 lg:border-r">
          <Eyebrow className="text-editorial">
            {user ? `Desk activ · ${activeDesk?.name ?? ""}` : "Ediția publică"}
          </Eyebrow>
          <h2 className="font-display mt-3 text-3xl font-black leading-[0.95] tracking-tight sm:text-5xl">
            {firstName ? `Bun venit, ${firstName}.` : "Contractele publice se decid înainte de a fi publicate."}
          </h2>
          <p className="font-body drop-cap mt-5 text-base leading-relaxed text-stock-700">
            RO-INTEL urmărește registrele publice, consultările de piață și anunțurile de intenție din România și le
            transformă în semnale calificate — cu mult înainte ca procedura să apară în SEAP. Fiecare poziție primește
            un scor pe baza dovezilor din sursă, nu a unei estimări: dacă o sursă nu răspunde sau nu are date, sistemul
            raportează zero, nu inventează.
          </p>

          <div className="mt-7 flex flex-col gap-3 sm:flex-row">
            <ButtonLink href={user ? "/newsletter" : "/login"} className="sm:flex-none">
              {user ? "Deschide registrul" : "Autentificare"}
            </ButtonLink>
            <ButtonLink href="/analysis" variant="outline" className="sm:flex-none">
              Analiza de piață
            </ButtonLink>
          </div>
        </div>

        <aside className="p-5 sm:p-8 lg:col-span-4">
          <Eyebrow>Cea mai mare poziție</Eyebrow>
          {loading ? (
            <p className="font-body mt-3 text-sm text-stock-500">Se încarcă…</p>
          ) : leadStory ? (
            <div className="mt-3">
              <h3 className="font-display text-xl font-bold leading-tight">{leadStory.project_title}</h3>
              <p className="font-body mt-2 text-sm leading-relaxed text-stock-600">
                {leadStory.entity_name} · {leadStory.county}
              </p>
              <p className="tabular font-display mt-4 border-t border-ink pt-3 text-3xl font-black">
                {formatLeadValue(leadStory.financial_value_ron)}
              </p>
              {leadStory.opportunity_score != null && (
                <p className="font-mono mt-1 text-[11px] uppercase tracking-widest text-stock-500">
                  Scor {leadStory.opportunity_score} / 10
                </p>
              )}
            </div>
          ) : (
            <div className="mt-3">
              <p className="font-body text-sm leading-relaxed text-stock-600">
                Pozițiile identificate nominal sunt vizibile doar pentru conturile autentificate. Cifrele agregate de
                mai sus rămân publice.
              </p>
              <ButtonLink href="/login" variant="outline" fullWidth className="mt-5">
                Deblochează dosarele
              </ButtonLink>
            </div>
          )}
        </aside>
      </section>

      <Ornament />

      {/* Section index */}
      <div className="mb-4 flex items-baseline justify-between gap-3 border-b border-ink pb-2">
        <h2 className="font-display text-2xl font-bold tracking-tight">Secțiuni</h2>
        <span className="label-eyebrow text-stock-500">{SECTIONS.length} rubrici</span>
      </div>

      {/* Standalone clippings rather than a collapsed grid: the hard offset
          shadow needs each card to sit on its own ground to read as a
          cut-out lifting off the page. */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {SECTIONS.map((section) => (
          <Link
            key={section.href}
            href={section.href}
            className="hard-shadow-hover flex flex-col border border-ink bg-paper p-5 sm:p-6"
          >
            <Eyebrow className="text-editorial">{section.kicker}</Eyebrow>
            <h3 className="font-display mt-2 text-xl font-bold leading-snug tracking-tight">{section.title}</h3>
            <p className="font-body mt-2 flex-1 text-sm leading-relaxed text-stock-600">{section.body}</p>
            <span className="font-sans mt-4 text-[11px] font-semibold uppercase tracking-widest underline decoration-editorial decoration-2 underline-offset-4">
              Deschide
            </span>
          </Link>
        ))}
      </div>

      <footer className="mt-10 border-t-4 border-ink pt-5">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <span className="label-eyebrow text-stock-500">
            RO-INTEL · Registrul Oportunităților Publice
          </span>
          <span className="label-eyebrow text-stock-400">
            Date colectate din surse publice oficiale
          </span>
        </div>
      </footer>
    </main>
  );
}
