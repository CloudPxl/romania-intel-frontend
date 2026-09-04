"use client";
import React, { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/context/AuthContext";
import { ApiError, fetchMarketTrends, type MarketTrendFilters, type MarketTrends } from "@/lib/api";
import { CATEGORIES, formatDate, formatNumber, formatRon } from "@/lib/format";
import MarketTrendsView from "@/components/MarketTrendsView";
import {
  Button,
  DegradedBanner,
  EmptyState,
  Eyebrow,
  Field,
  Input,
  Loading,
  Notice,
  PageHeader,
  Panel,
  Select,
  StatCell,
} from "@/components/newsprint";

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
          <div className="rule-grid grid grid-cols-2 lg:grid-cols-4">
            <StatCell label="Dosare în selecție" value={formatNumber(data.total_leads)} />
            <StatCell label="Valoare totală" value={formatRon(data.total_market_value_ron)} />
            <StatCell
              label="Scor mediu"
              value={data.average_opportunity_score != null ? `${data.average_opportunity_score} / 10` : "—"}
            />
            <StatCell label="Actualizat" value={formatDate(data.updated_at)} hint={`${data.by_county.length} județe`} />
          </div>

          <div className="mt-8">
            <MarketTrendsView data={data} variant="full" />
          </div>

          {data.is_authenticated && (
            <p className="mt-10 border-t border-divider pt-5 text-center">
              <Link href="/cautare-avansata" className="font-sans text-sm font-medium text-editorial hover:brightness-110">
                Vezi toate dosarele în căutarea avansată →
              </Link>
            </p>
          )}
        </>
      )}
    </main>
  );
}
