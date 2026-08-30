"use client";
import React, { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/context/AuthContext";
import { ApiError, fetchMarketTrends, type MarketTrendFilters, type MarketTrends } from "@/lib/api";
import { CATEGORIES, formatDate, formatNumber, formatRon } from "@/lib/format";
import {
  Button,
  ButtonLink,
  DegradedBanner,
  EmptyState,
  Eyebrow,
  Field,
  Input,
  Loading,
  Notice,
  PageHeader,
  Panel,
  SectionTitle,
  Select,
  StatCell,
} from "@/components/newsprint";

/** Horizontal bar row. Width is share-of-max within the current slice. */
function BarRow({ label, count, value, maxValue }: { label: string; count: number; value: number; maxValue: number }) {
  const pct = maxValue > 0 ? Math.max(2, Math.round((value / maxValue) * 100)) : 0;
  return (
    <div className="border-b border-divider py-3 last:border-b-0">
      <div className="flex items-baseline justify-between gap-3">
        <span className="font-body truncate text-sm font-semibold">{label}</span>
        <span className="tabular font-mono shrink-0 text-[11px] text-stock-500">
          {count} · {formatRon(value)}
        </span>
      </div>
      <div className="mt-1.5 h-2 w-full bg-stock-200">
        <div className="h-full bg-ink" style={{ width: `${pct}%` }} role="presentation" />
      </div>
    </div>
  );
}

export default function AnalysisPage() {
  const { user } = useAuth();
  const [data, setData] = useState<MarketTrends | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filtersOpen, setFiltersOpen] = useState(false);

  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [category, setCategory] = useState("");
  const [county, setCounty] = useState("");
  const [minValue, setMinValue] = useState("");
  const [maxValue, setMaxValue] = useState("");

  const load = useCallback(
    async (filters: MarketTrendFilters = {}) => {
      setLoading(true);
      setError(null);
      try {
        setData(await fetchMarketTrends(filters));
      } catch (e) {
        setError(e instanceof ApiError ? e.detail : "Nu s-a putut încărca analiza de piață.");
        setData(null);
      } finally {
        setLoading(false);
      }
    },
    []
  );

  useEffect(() => {
    load();
  }, [load, user]);

  const applyFilters = () => {
    load({
      start_date: startDate || undefined,
      end_date: endDate || undefined,
      categories: category ? [category] : undefined,
      counties: county.trim() ? [county.trim()] : undefined,
      min_value_ron: minValue ? Number(minValue) : undefined,
      max_value_ron: maxValue ? Number(maxValue) : undefined,
    });
  };

  const resetFilters = () => {
    setStartDate("");
    setEndDate("");
    setCategory("");
    setCounty("");
    setMinValue("");
    setMaxValue("");
    load();
  };

  const activeFilterCount = Object.keys(data?.filters_applied ?? {}).filter((k) => k !== "limit").length;
  const maxCounty = Math.max(0, ...(data?.by_county ?? []).map((c) => c.value_ron));
  const maxCategory = Math.max(0, ...(data?.by_category ?? []).map((c) => c.value_ron));
  const maxFunding = Math.max(0, ...(data?.by_funding_source ?? []).map((c) => c.value_ron));

  return (
    <main className="mx-auto w-full max-w-screen-xl flex-1 px-4 py-6 sm:py-8">
      <PageHeader
        eyebrow="Analiza de piață"
        title="Unde se concentrează bugetul public"
        standfirst="Agregări recalculate la fiecare interogare din datele curente din registru. Nu există cache la acest nivel — un filtru aplicat interoghează baza de date din nou."
        action={
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => setFiltersOpen((v) => !v)} aria-expanded={filtersOpen}>
              {filtersOpen ? "Ascunde filtre" : `Filtre${activeFilterCount ? ` (${activeFilterCount})` : ""}`}
            </Button>
            <Button variant="outline" onClick={() => load()} disabled={loading}>
              {loading ? "Se încarcă…" : "Reîncarcă"}
            </Button>
          </div>
        }
      />

      {filtersOpen && (
        <Panel className="mb-6 p-4 sm:p-5">
          <Eyebrow className="mb-4">Restrânge analiza</Eyebrow>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <Field label="De la data">
              <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
            </Field>
            <Field label="Până la data">
              <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
            </Field>
            <Field label="Domeniu">
              <Select value={category} onChange={(e) => setCategory(e.target.value)}>
                <option value="">Toate domeniile</option>
                {CATEGORIES.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.label}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Județ">
              <Input value={county} onChange={(e) => setCounty(e.target.value)} placeholder="ex. Cluj" />
            </Field>
            <Field label="Valoare minimă (RON)">
              <Input type="number" min={0} value={minValue} onChange={(e) => setMinValue(e.target.value)} />
            </Field>
            <Field label="Valoare maximă (RON)">
              <Input type="number" min={0} value={maxValue} onChange={(e) => setMaxValue(e.target.value)} />
            </Field>
          </div>
          <div className="mt-5 flex flex-col gap-3 sm:flex-row">
            <Button onClick={applyFilters} disabled={loading}>
              Aplică filtrele
            </Button>
            <Button variant="ghost" onClick={resetFilters} disabled={loading}>
              Resetează
            </Button>
          </div>
        </Panel>
      )}

      {data?.degraded && <DegradedBanner detail={data.detail} />}

      {error && (
        <div className="mb-6">
          <Notice tone="alert" title="Eroare">
            {error}
          </Notice>
        </div>
      )}

      {loading ? (
        <Loading label="Se calculează agregările" />
      ) : !data || data.total_leads === 0 ? (
        <EmptyState title="Nu există date pentru această selecție">
          {activeFilterCount > 0
            ? "Niciun dosar nu corespunde filtrelor aplicate. Extindeți intervalul sau eliminați un criteriu."
            : "Registrul nu conține încă dosare. Datele apar automat după primul ciclu de scanare."}
        </EmptyState>
      ) : (
        <>
          <div className="rule-grid grid grid-cols-2 border border-ink lg:grid-cols-4">
            <StatCell label="Dosare în selecție" value={formatNumber(data.total_leads)} />
            <StatCell label="Valoare totală" value={formatRon(data.total_market_value_ron)} />
            <StatCell
              label="Scor mediu"
              value={data.average_opportunity_score != null ? `${data.average_opportunity_score} / 10` : "—"}
            />
            <StatCell label="Actualizat" value={formatDate(data.updated_at)} hint={`${data.by_county.length} județe`} />
          </div>

          <div className="mt-8 grid grid-cols-1 gap-8 lg:grid-cols-2">
            <section>
              <SectionTitle note={`${data.by_category.length} domenii`}>Distribuție pe domeniu</SectionTitle>
              <div>
                {data.by_category.map((c) => (
                  <BarRow key={c.category} label={c.category} count={c.count} value={c.value_ron} maxValue={maxCategory} />
                ))}
              </div>
            </section>

            <section>
              <SectionTitle note="top 10">Județe după valoare</SectionTitle>
              <div>
                {data.by_county.slice(0, 10).map((c) => (
                  <BarRow key={c.county} label={c.county} count={c.count} value={c.value_ron} maxValue={maxCounty} />
                ))}
              </div>
            </section>

            <section>
              <SectionTitle note={`${data.by_funding_source.length} surse`}>Surse de finanțare</SectionTitle>
              <div>
                {data.by_funding_source.map((f) => (
                  <BarRow
                    key={f.funding_source}
                    label={f.funding_source}
                    count={f.count}
                    value={f.value_ron}
                    maxValue={maxFunding}
                  />
                ))}
              </div>
            </section>

            <section>
              <SectionTitle note={data.is_authenticated ? "top 10" : "restricționat"}>
                Cele mai mari poziții
              </SectionTitle>
              {data.is_authenticated ? (
                <ol className="border-t border-divider">
                  {data.top_opportunities.map((o, i) => (
                    <li key={`${o.project_title}-${i}`} className="flex gap-4 border-b border-divider py-3">
                      <span className="tabular font-mono w-6 shrink-0 pt-0.5 text-sm text-stock-400">
                        {String(i + 1).padStart(2, "0")}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="font-body truncate text-sm font-semibold">{o.project_title}</p>
                        <p className="font-mono truncate text-[11px] text-stock-500">
                          {o.entity_name} · {o.county}
                        </p>
                      </div>
                      <span className="tabular font-display shrink-0 text-sm font-black">
                        {formatRon(o.financial_value_ron)}
                      </span>
                    </li>
                  ))}
                </ol>
              ) : (
                <div className="border border-ink p-6">
                  <Eyebrow className="text-editorial">Necesită autentificare</Eyebrow>
                  <p className="font-body mt-2 text-sm leading-relaxed text-stock-600">
                    Cifrele agregate sunt publice. Pozițiile identificate nominal — autoritate, titlu de proiect,
                    valoare — sunt vizibile doar conturilor autentificate.
                  </p>
                  <ButtonLink href="/login" variant="outline" fullWidth className="mt-5">
                    Autentificare
                  </ButtonLink>
                </div>
              )}
            </section>
          </div>

          {data.is_authenticated && (
            <p className="mt-10 border-t-4 border-ink pt-5 text-center">
              <Link
                href="/newsletter"
                className="font-sans text-[11px] font-semibold uppercase tracking-widest underline decoration-editorial decoration-2 underline-offset-4"
              >
                Vezi toate dosarele în registrul zilnic →
              </Link>
            </p>
          )}
        </>
      )}
    </main>
  );
}
