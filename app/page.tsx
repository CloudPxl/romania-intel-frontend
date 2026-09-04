"use client";
import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/context/AuthContext";
import OnboardingForm from "@/components/OnboardingForm";
import MarketTrendsView from "@/components/MarketTrendsView";
import { ApiError, fetchMarketTrends, fetchMyMarketTrends, type MarketTrends } from "@/lib/api";
import { formatDateline, formatLeadValue, formatNumber, formatRon } from "@/lib/format";
import {
  ButtonLink,
  CountUp,
  DegradedBanner,
  Eyebrow,
  Loading,
  Notice,
  Ornament,
  ProgressBar,
  StatCell,
} from "@/components/newsprint";

/** `tags` name what each section actually contains — they are revealed on
 *  hover rather than shown at rest, so the grid gains density on demand
 *  instead of carrying six rows of chips by default. */
const SECTIONS = [
  {
    href: "/cautare-avansata",
    kicker: "Căutare avansată",
    title: "Oportunități pre-SEAP, filtrate pe linia dvs. de produse",
    body: "Fluxul complet de semnale calificate din registrele publice, cu dosar strategic pentru fiecare poziție și salvare directă în pipeline.",
    tags: ["Filtre pe județ", "Dosar strategic", "Export CSV"],
  },
  {
    href: "/analysis",
    kicker: "Analiza de piață",
    title: "Unde se concentrează bugetul public, în cifre",
    body: "Distribuție pe județ, domeniu și sursă de finanțare, recalculată la fiecare interogare din datele curente.",
    tags: ["Pe județ", "Pe domeniu", "Sursă finanțare"],
  },
  {
    href: "/eligibility",
    kicker: "Eligibilitate",
    title: "Verificarea profilului înainte de a angaja resurse",
    body: "Motivele de excludere obligatorii din Legea 98/2016 și liniile de finanțare pentru care compania se califică.",
    tags: ["Legea 98/2016", "Linii de finanțare"],
  },
  {
    href: "/drafting",
    kicker: "Redactare",
    title: "Propuneri tehnice și solicitări de clarificare",
    body: "Documente structurate conform legislației naționale, exportabile direct în format .docx.",
    tags: ["Propunere tehnică", "Clarificări", "Export .docx"],
  },
  {
    href: "/analytics",
    kicker: "Strategie",
    title: "Copilot, radar concurență și scanner caiet de sarcini",
    body: "Analiza clauzelor restrictive, profilul pieței observate și poziționarea financiară față de valoarea estimată.",
    tags: ["Copilot", "Clauze restrictive", "Poziționare preț"],
  },
  {
    href: "/pipeline",
    kicker: "Ofertare",
    title: "Stadiul real al dosarelor aflate în lucru",
    body: "Valoare ponderată pe etapă, timp mediu petrecut în fiecare fază și rate de conversie din istoricul propriu.",
    tags: ["8 etape", "Valoare ponderată", "Rate conversie"],
  },
];

export default function HomePage() {
  const { user, needsOnboarding } = useAuth();

  // Anonymous, still resolving the session, or mid-onboarding all fall
  // through to the public page below — `user` is null for the first two,
  // so the public branch is what every visitor sees before we know better.
  // This is the exact page that existed before personalization: unchanged
  // on purpose, so nothing about the anonymous experience regresses.
  if (user && needsOnboarding) {
    return <OnboardingForm />;
  }
  if (user) {
    return <PersonalizedHomePage />;
  }
  return <PublicHomePage />;
}

/**
 * Signed in and onboarded: Prima Pagina becomes a trimmed, personalized
 * version of Analiza de Piață — "metrics that only serve the user's own
 * criteria," not the whole market with matches merely ranked higher. The
 * full, unfiltered market with every metric lives one click away on
 * /analysis; this page keeps only what answers "what changed for me."
 */
function PersonalizedHomePage() {
  const { user, profile } = useAuth();
  const [stats, setStats] = useState<MarketTrends | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dateline, setDateline] = useState("");

  useEffect(() => setDateline(formatDateline()), []);

  useEffect(() => {
    let mounted = true;
    fetchMyMarketTrends()
      .then((d) => mounted && setStats(d))
      .catch((e) => {
        if (!mounted) return;
        setError(e instanceof ApiError ? e.detail : "Nu s-au putut încărca oportunitățile dvs.");
        setStats(null);
      })
      .finally(() => mounted && setLoading(false));
    return () => {
      mounted = false;
    };
  }, []);

  const firstName = user?.full_name?.split(" ")[0];
  const leadStory = stats?.top_opportunities?.[0];
  const topCounty = stats?.by_county?.[0];
  const isPersonalized = stats?.is_personalized !== false;

  return (
    <main className="mx-auto w-full max-w-screen-xl flex-1 px-4 py-6 sm:py-10">
      {stats?.degraded && <DegradedBanner detail={stats.detail} />}

      <div className="stagger pb-2">
        <h1 className="font-display mt-3 text-3xl font-semibold leading-[1.05] tracking-tight sm:text-5xl">
          {firstName ? `Bun venit, ${firstName}.` : "Bun venit."}
        </h1>
        <p className="font-mono mt-4 text-[11px] uppercase tracking-[0.2em] text-stock-500">
          {dateline || " "} · Criterii active: {profile?.domain ?? "—"}
        </p>
      </div>

      {!loading && !error && !isPersonalized && (
        <div className="stagger mt-5">
          <Notice tone="neutral" title="Niciun dosar nu corespunde criteriilor dvs.">
            Cifrele de mai jos arată toată piața, nu doar potrivirile dvs. Ajustați cuvintele-cheie, județele sau
            valoarea minimă din setările profilului pentru a primi potriviri.
          </Notice>
        </div>
      )}

      {error && (
        <div className="stagger mt-5">
          <Notice tone="alert">{error}</Notice>
        </div>
      )}

      {loading ? (
        <div className="mt-8">
          <Loading label="Se calculează potrivirile dvs." />
        </div>
      ) : (
        <>
          <div className="rule-grid stagger mt-8 grid grid-cols-2 lg:grid-cols-4">
            <StatCell
              label={isPersonalized ? "Dosare potrivite" : "Dosare în registru"}
              tooltip="Numărul de oportunități care corespund criteriilor dvs. de monitorizare."
              value={<CountUp value={stats?.total_leads ?? 0} format={(n) => formatNumber(Math.round(n))} />}
            />
            <StatCell
              label={isPersonalized ? "Valoare potriviri" : "Valoare totală piață"}
              tooltip="Suma valorilor estimate ale dosarelor de mai sus."
              value={<CountUp value={stats?.total_market_value_ron ?? 0} format={(n) => formatRon(n)} />}
            />
            <StatCell
              label="Scor mediu oportunitate"
              tooltip="Media scorului de relevanță (0–10), calculat din dovezile găsite în textul sursei."
              value={
                stats?.average_opportunity_score != null ? (
                  <CountUp value={stats.average_opportunity_score} format={(n) => `${n.toFixed(1)} / 10`} />
                ) : (
                  "—"
                )
              }
              detail={
                stats?.average_opportunity_score != null ? (
                  <ProgressBar value={stats.average_opportunity_score} max={10} label="Scor mediu" />
                ) : undefined
              }
            />
            <StatCell
              label={isPersonalized ? "Județ cu volum maxim (potriviri)" : "Județ cu volum maxim"}
              value={topCounty?.county ?? "—"}
              hint={topCounty ? formatRon(topCounty.value_ron) : undefined}
            />
          </div>

          <section
            className="rise mt-8 grid grid-cols-1 gap-0 neu-flat overflow-hidden rounded-3xl bg-paper lg:grid-cols-12"
            style={{ animationDelay: "240ms" }}
          >
            <div className="border-b border-divider p-5 sm:p-8 lg:col-span-8 lg:border-b-0 lg:border-r">
              <Eyebrow className="text-editorial">Profil activ · {profile?.display_name ?? user?.email}</Eyebrow>
              <h2 className="font-display mt-3 text-2xl font-semibold leading-tight tracking-tight sm:text-4xl">
                {isPersonalized ? "Poziția dvs. cea mai bine plasată" : "Cea mai mare poziție din piață"}
              </h2>
              <p className="font-body mt-5 text-base leading-relaxed text-stock-600">
                Registrul urmărește continuu criteriile dvs. — domeniu, județe, cuvinte-cheie și valoare minimă — și
                ordonează piața în funcție de ele. Modificați oricând criteriile din bara laterală; ordinea de mai
                jos se actualizează automat.
              </p>
              <div className="mt-7 flex flex-col gap-3 sm:flex-row">
                <ButtonLink href="/cautare-avansata" className="sm:flex-none">
                  Deschide căutarea avansată
                </ButtonLink>
                <ButtonLink href="/analysis" variant="outline" className="sm:flex-none">
                  Toată piața
                </ButtonLink>
              </div>
            </div>

            <aside className="p-5 sm:p-8 lg:col-span-4">
              <Eyebrow>{isPersonalized ? "Cea mai bună potrivire" : "Cea mai mare poziție"}</Eyebrow>
              {leadStory ? (
                <div className="mt-3">
                  <h3 className="font-display text-xl font-bold leading-tight">{leadStory.project_title}</h3>
                  <p className="font-body mt-2 text-sm leading-relaxed text-stock-600">
                    {leadStory.entity_name} · {leadStory.county}
                  </p>
                  <p className="tabular font-display mt-4 border-t border-divider pt-3 text-3xl font-semibold">
                    {formatLeadValue(leadStory.financial_value_ron)}
                  </p>
                  {leadStory.opportunity_score != null && (
                    <p className="font-mono mt-1 text-[11px] uppercase tracking-widest text-stock-500">
                      Scor {leadStory.opportunity_score} / 10
                    </p>
                  )}
                </div>
              ) : (
                <p className="font-body mt-3 text-sm leading-relaxed text-stock-600">
                  Nicio poziție disponibilă momentan.
                </p>
              )}
            </aside>
          </section>

          {stats && (
            <div className="stagger mt-8">
              <MarketTrendsView data={stats} variant="compact" />
            </div>
          )}
        </>
      )}
    </main>
  );
}

/**
 * Anonymous, or still resolving the session. Unchanged from before
 * personalization existed — a public snapshot of the whole market, the
 * product's section index, and a way in.
 */
function PublicHomePage() {
  const { user } = useAuth();
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

  const leadStory = stats?.top_opportunities?.[0];
  const topCounty = stats?.by_county?.[0];
  const topCategory = stats?.by_category?.[0];

  return (
    <main className="mx-auto w-full max-w-screen-xl flex-1 px-4 py-6 sm:py-10">
      {stats?.degraded && <DegradedBanner detail={stats.detail} />}

      {/* Masthead */}
      <div className="stagger pb-2 text-center">
        <Eyebrow className="text-editorial">Intelligence achiziții publice · România</Eyebrow>
        <h1 className="font-display mt-3 text-4xl font-semibold leading-[1.05] tracking-tight sm:text-6xl lg:text-7xl">
          Registrul Oportunităților Publice
        </h1>
        <p className="font-mono mt-4 text-[11px] uppercase tracking-[0.2em] text-stock-500">
          {dateline || " "} · Ediție națională
        </p>
      </div>

      {/* Live figures ticker. Each figure counts up from zero, and each cell
          carries a second layer that appears only on hover — the resting grid
          stays scannable while the detail sits one gesture away. */}
      <div className="rule-grid stagger mt-8 grid grid-cols-2 lg:grid-cols-4">
        <StatCell
          label="Dosare în registru"
          tooltip="Numărul total de oportunități calificate aflate în registru la această oră."
          value={<CountUp value={stats?.total_leads ?? 0} format={(n) => formatNumber(Math.round(n))} />}
          loading={loading}
          detail={
            topCategory
              ? `Cel mai activ domeniu: ${topCategory.category}, cu ${formatNumber(topCategory.count)} dosare.`
              : "Distribuția pe domenii devine disponibilă după prima colectare."
          }
        />
        <StatCell
          label="Valoare totală piață"
          tooltip="Suma valorilor estimate ale tuturor dosarelor din registru."
          value={<CountUp value={stats?.total_market_value_ron ?? 0} format={(n) => formatRon(n)} />}
          loading={loading}
          hint={topCategory ? `Domeniu dominant: ${topCategory.category}` : undefined}
          detail="Valorile provin din anunțurile publice. Acolo unde autoritatea nu publică o estimare, dosarul intră fără valoare — nu cu una presupusă."
        />
        <StatCell
          label="Scor mediu oportunitate"
          tooltip="Media scorului de relevanță (0–10), calculat din dovezile găsite în textul sursei."
          value={
            stats?.average_opportunity_score != null ? (
              <CountUp value={stats.average_opportunity_score} format={(n) => `${n.toFixed(1)} / 10`} />
            ) : (
              "—"
            )
          }
          loading={loading}
          detail={
            stats?.average_opportunity_score != null ? (
              <>
                <ProgressBar
                  value={stats.average_opportunity_score}
                  max={10}
                  label="Scor mediu al oportunităților"
                  className="mb-2"
                />
                Scorul crește doar cu dovezi din textul sursei — domeniul și județul îl întăresc, nu îl creează.
              </>
            ) : undefined
          }
        />
        <StatCell
          label="Județ cu volum maxim"
          tooltip="Județul care concentrează cea mai mare valoare cumulată a dosarelor."
          value={topCounty?.county ?? "—"}
          loading={loading}
          hint={topCounty ? formatRon(topCounty.value_ron) : undefined}
          detail={
            topCounty
              ? `${formatNumber(topCounty.count)} dosare active în ${topCounty.county}.`
              : "Clasamentul pe județe apare după prima colectare."
          }
        />
      </div>

      {/* Lead article */}
      <section
        className="rise mt-8 grid grid-cols-1 gap-0 neu-flat overflow-hidden rounded-3xl bg-paper lg:grid-cols-12"
        style={{ animationDelay: "240ms" }}
      >
        <div className="border-b border-divider p-5 sm:p-8 lg:col-span-8 lg:border-b-0 lg:border-r">
          <Eyebrow className="text-editorial">Ediția publică</Eyebrow>
          <h2 className="font-display mt-3 text-2xl font-semibold leading-tight tracking-tight sm:text-4xl">
            Contractele publice se decid înainte de a fi publicate.
          </h2>
          <p className="font-body mt-5 text-base leading-relaxed text-stock-600">
            RO-INTEL urmărește registrele publice, consultările de piață și anunțurile de intenție din România și le
            transformă în semnale calificate — cu mult înainte ca procedura să apară în SEAP. Fiecare poziție primește
            un scor pe baza dovezilor din sursă, nu a unei estimări: dacă o sursă nu răspunde sau nu are date, sistemul
            raportează zero, nu inventează.
          </p>

          <div className="mt-7 flex flex-col gap-3 sm:flex-row">
            <ButtonLink href="/login" className="sm:flex-none">
              Autentificare
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
              <p className="tabular font-display mt-4 border-t border-divider pt-3 text-3xl font-semibold">
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
      <div className="mb-4 flex items-baseline justify-between gap-3 border-b border-divider pb-2">
        <h2 className="font-display text-2xl font-bold tracking-tight">Secțiuni</h2>
        <span className="label-eyebrow text-stock-500">{SECTIONS.length} rubrici</span>
      </div>

      <div className="stagger grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {SECTIONS.map((section) => (
          <Link
            key={section.href}
            href={section.href}
            className="group flex flex-col neu-flat rounded-3xl bg-paper p-5 transition-all duration-[var(--duration-base)] ease-[var(--ease-glide)] hover:neu-glow hover:-translate-y-1 active:scale-[0.99] sm:p-6"
          >
            <Eyebrow className="text-editorial">{section.kicker}</Eyebrow>
            <h3 className="font-display mt-2 text-xl font-semibold leading-snug tracking-tight text-ink">{section.title}</h3>
            <p className="font-body mt-2 flex-1 text-sm leading-relaxed text-stock-500">{section.body}</p>
            {/* Quick actions surface on hover, so the resting card keeps its
                editorial calm and the grid does not read as a wall of chips. */}
            <div className="reveal">
              <div>
                <div className="mt-3 flex flex-wrap gap-1.5 border-t border-divider pt-3">
                  {section.tags.map((tag) => (
                    <span
                      key={tag}
                      className="neu-pressed-sm rounded-full bg-paper px-2.5 py-1 font-sans text-[11px] font-semibold text-stock-600"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            </div>
            <span className="font-sans mt-4 inline-flex items-center gap-1 text-[13px] font-medium text-editorial">
              Deschide
              <span
                aria-hidden="true"
                className="transition-transform duration-[var(--duration-base)] ease-[var(--ease-spring)] group-hover:translate-x-1"
              >
                →
              </span>
            </span>
          </Link>
        ))}
      </div>

      <footer className="mt-10 border-t border-divider pt-5">
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
