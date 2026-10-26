"use client";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/context/AuthContext";
import OnboardingForm from "@/components/OnboardingForm";
import LeadDossierPanel from "@/components/LeadDossierPanel";
import LandingPage from "@/components/landing/LandingPage";
import { ProfileCriteriaModal } from "@/components/EnterpriseModals";
import { ApiError, fetchMyFeed, type Lead } from "@/lib/api";
import { DOMAIN_OPTIONS, formatDateline, formatNumber, formatRon } from "@/lib/format";
import { DegradedBanner, Loading, Notice, PageHeader, StatCell, StatStrip } from "@/components/newsprint";
import { EmptyRegistryState, LeadList, NoResultsRelaxationBanner, daysLeft, deadlineLabel } from "@/components/registry";
import { cn } from "@/lib/utils";

export default function HomePage() {
  const { user, needsOnboarding } = useAuth();
  // Onboarding first, on its own: a fresh Google sign-in must reach the
  // setup form, not the public page.
  if (needsOnboarding) return <OnboardingForm />;
  if (user) return <Dashboard />;
  return <LandingPage />;
}

function SideList({ title, note, leads, onOpen, empty, more }: { title: string; note?: string; leads: Lead[]; onOpen: (l: Lead) => void; empty: string; more?: React.ReactNode }) {
  return (
    <section className="min-w-0">
      <div className="mb-3 flex items-baseline gap-2">
        <h2 className="text-lg font-semibold leading-[26px] tracking-[-0.01em] sm:text-xl sm:leading-7">{title}</h2>
        {note && <span className="text-[13px] text-stock-400">{note}</span>}
        <span className="flex-1" />
        {more}
      </div>
      <LeadList leads={leads} onOpen={onOpen} showWhy={false} empty={<p className="px-5 py-6 text-[15px] text-stock-500">{empty}</p>} />
    </section>
  );
}

function Dashboard() {
  const { user, profile } = useAuth();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [degraded, setDegraded] = useState(false);
  const [selected, setSelected] = useState<Lead | null>(null);
  const [criteriaOpen, setCriteriaOpen] = useState(false);
  const [dateline, setDateline] = useState("");
  // "Now" for the 72-hour window, taken once per visit (render stays pure).
  const [now] = useState(() => Date.now());

  // The profile's criteria as chips, all on (the personalised view); taking
  // one off widens the lists below.
  const [useDomain, setUseDomain] = useState(true);
  const [useCounties, setUseCounties] = useState(true);
  const [useKeywords, setUseKeywords] = useState(true);
  const [useMin, setUseMin] = useState(true);
  const [onlyMatches, setOnlyMatches] = useState(true);

  useEffect(() => setDateline(formatDateline()), []);

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    fetchMyFeed(useDomain && profile?.domain && profile.domain !== "toate" ? profile.domain : undefined)
      .then((feed) => {
        if (!mounted) return;
        setLeads(feed.leads || []);
        setDegraded(Boolean(feed.degraded));
        setError(null);
      })
      .catch((e) => mounted && setError(e instanceof ApiError ? e.detail : "Nu s-au putut încărca licitațiile dvs."))
      .finally(() => mounted && setLoading(false));
    return () => {
      mounted = false;
    };
  }, [useDomain, profile?.domain]);

  const counties = useMemo(() => profile?.target_counties ?? [], [profile]);
  const keywords = useMemo(() => profile?.keywords ?? [], [profile]);
  const minValue = profile?.min_value_ron ?? 0;
  const domainLabel = profile?.domain ? DOMAIN_OPTIONS.find((d) => d.id === profile.domain)?.label ?? profile.domain : "Toate domeniile";

  const filtered = useMemo(() => {
    const fold = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
    const wanted = new Set(counties.map(fold));
    const kws = keywords.map(fold).filter(Boolean);
    return leads.filter((l) => {
      if (onlyMatches && !l.match?.is_match) return false;
      if (useCounties && wanted.size && !wanted.has(fold(l.county || ""))) return false;
      if (useMin && minValue > 0 && (l.financial_value_ron || 0) < minValue) return false;
      if (useKeywords && kws.length) {
        const hay = fold(`${l.project_title} ${l.executive_summary || ""} ${l.entity_name || ""}`);
        if (!kws.some((k) => hay.includes(k))) return false;
      }
      return true;
    });
  }, [leads, onlyMatches, useCounties, useMin, useKeywords, counties, keywords, minValue]);

  const open = filtered.filter((l) => {
    const d = daysLeft(l.action_deadline);
    return d === null || d >= 0;
  });
  const dueSoon = open
    .filter((l) => {
      const d = daysLeft(l.action_deadline);
      return d !== null && d <= 14;
    })
    .sort((a, b) => (daysLeft(a.action_deadline) ?? 99) - (daysLeft(b.action_deadline) ?? 99));
  const fresh = filtered
    .filter((l) => l.published_date && now - Date.parse(l.published_date) <= 3 * 86400000)
    .sort((a, b) => (b.published_date || "").localeCompare(a.published_date || ""));
  const totalValue = open.reduce((s, l) => s + (l.financial_value_ron || 0), 0);
  const hasMatches = leads.some((l) => l.match?.is_match);
  const firstName = user?.full_name?.split(" ")[0];

  const chips = [
    { label: "Domeniu", value: domainLabel, on: useDomain, set: setUseDomain, applicable: Boolean(profile?.domain && profile.domain !== "toate") },
    { label: "Județe", value: counties.length ? counties.join(", ") : "nesetat", on: useCounties, set: setUseCounties, applicable: counties.length > 0 },
    { label: "Cuvinte", value: keywords.length ? keywords.join(", ") : "nesetat", on: useKeywords, set: setUseKeywords, applicable: keywords.length > 0 },
    { label: "Valoare", value: minValue ? `peste ${formatRon(minValue)}` : "nesetat", on: useMin, set: setUseMin, applicable: minValue > 0 },
  ];

  return (
    <main className="mx-auto w-full max-w-[1264px] flex-1 px-5 pb-16 pt-8 sm:px-8 sm:pt-12">
      <PageHeader
        eyebrow={dateline || " "}
        title={firstName ? `Bună ziua, ${firstName}.` : "Bună ziua."}
        standfirst="Licitațiile deschise care se potrivesc firmei dvs., ordonate după termen și potrivire."
      />

      <div className="mb-8 flex flex-wrap items-center gap-2" role="toolbar" aria-label="Criteriile profilului">
        {chips.map((c) => (
          <button
            key={c.label}
            type="button"
            disabled={!c.applicable}
            aria-pressed={c.applicable && c.on}
            onClick={() => c.set(!c.on)}
            aria-label={`${c.applicable ? (c.on ? "Elimină" : "Aplică") : "Nesetat"} criteriul ${c.label}: ${c.value}`}
            className={cn(
              "inline-flex min-h-9 max-w-[320px] items-center gap-1.5 rounded-lg border bg-paper px-3 text-[14px] transition-[opacity,background-color] duration-[var(--duration-base)]",
              !c.applicable
                ? "cursor-not-allowed border-dashed border-line-strong text-stock-400"
                : c.on
                  ? "border-line-strong text-ink hover:bg-surface-2"
                  : "border-dashed border-line-strong opacity-60"
            )}
          >
            <span className="text-stock-400">{c.label}:</span>
            <span className={cn("truncate", c.applicable && !c.on && "line-through")}>{c.value}</span>
          </button>
        ))}
        <button type="button" onClick={() => setCriteriaOpen(true)} className="inline-flex min-h-9 items-center rounded-lg px-3 text-[14px] font-medium text-accent hover:bg-surface-2">
          Editează criteriile
        </button>
      </div>

      {degraded && <DegradedBanner />}
      {error && (
        <div className="mb-6">
          <Notice tone="alert" title="Licitațiile nu s-au încărcat">
            {error}
          </Notice>
        </div>
      )}
      {!loading && !error && leads.length > 0 && !hasMatches && (
        <div className="mb-6">
          <Notice title="Niciun dosar nu corespunde criteriilor dvs.">
            Lărgiți criteriile sau{" "}
            <button className="font-medium text-accent underline underline-offset-2" onClick={() => setOnlyMatches(false)}>
              vedeți toată piața
            </button>
            .
          </Notice>
        </div>
      )}

      {loading ? (
        <Loading label="Se calculează potrivirile dvs." />
      ) : (
        <div className="flex flex-col gap-12">
          <StatStrip>
            <StatCell
              label={onlyMatches ? "potriviri cu termen încă deschis" : "licitații cu termen încă deschis"}
              value={formatNumber(open.length)}
              href="/cautare-avansata?matches=1"
              linkLabel="Deschide în Licitații"
            />
            <StatCell label="valoare estimată cumulată, fără TVA" value={formatRon(totalValue)} />
            <StatCell
              label="termene în următoarele 14 zile"
              value={formatNumber(dueSoon.length)}
              hint={dueSoon[0] ? `primul: ${deadlineLabel(daysLeft(dueSoon[0].action_deadline))}` : undefined}
            />
            <StatCell label="publicate în ultimele 72 de ore" value={formatNumber(fresh.length)} />
          </StatStrip>

          <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
            <SideList
              title="Termene în următoarele 14 zile"
              leads={dueSoon.slice(0, 5)}
              onOpen={setSelected}
              empty="Niciun termen de depunere în următoarele 14 zile."
              more={
                <Link href="/cautare-avansata?sort=deadline" className="text-[14px] font-medium text-accent hover:underline">
                  Toate →
                </Link>
              }
            />
            <SideList
              title="Noi pentru profilul dvs."
              note="ultimele 72 h"
              leads={fresh.slice(0, 5)}
              onOpen={setSelected}
              empty="Nicio licitație nouă în ultimele 72 de ore pentru aceste criterii."
            />
          </div>

          <section>
            <div className="mb-3 flex items-baseline gap-2">
              <h2 className="text-lg font-semibold leading-[26px] tracking-[-0.01em] sm:text-xl sm:leading-7">
                {onlyMatches ? "Cele mai potrivite licitații" : "Licitații din piață"}
              </h2>
              <span className="tabular text-[13px] text-stock-400">
                {Math.min(open.length, 12)} din {formatNumber(open.length)}
              </span>
              <span className="flex-1" />
              <Link href="/cautare-avansata" className="text-[14px] font-medium text-accent hover:underline">
                Toate în Licitații →
              </Link>
            </div>
            <LeadList
              leads={open.slice(0, 12)}
              onOpen={setSelected}
              selectedId={selected?.source_id}
              empty={
                leads.length > 0 ? (
                  <NoResultsRelaxationBanner
                    title="Criteriile active exclud toate licitațiile deschise"
                    message="Scoateți un criteriu din lista de sus sau vedeți toată piața."
                    actionLabel="Vezi toată piața"
                    onAction={() => {
                      setOnlyMatches(false);
                      setUseCounties(false);
                      setUseKeywords(false);
                      setUseMin(false);
                    }}
                  />
                ) : (
                  <EmptyRegistryState onEditCriteria={() => setCriteriaOpen(true)} />
                )
              }
            />
          </section>
        </div>
      )}

      {selected && <LeadDossierPanel key={selected.source_id} lead={selected} onClose={() => setSelected(null)} />}
      <ProfileCriteriaModal isOpen={criteriaOpen} onClose={() => setCriteriaOpen(false)} />
    </main>
  );
}
