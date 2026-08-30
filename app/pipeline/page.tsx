"use client";
import React, { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import AuthGate from "@/components/AuthGate";
import {
  ApiError,
  fetchPipelineMetrics,
  fetchTenantPipeline,
  updatePipelineDeal,
  type Deal,
  type PipelineMetrics,
} from "@/lib/api";
import { formatDate, formatNumber, formatPercent, formatRon, stageLabel } from "@/lib/format";
import {
  Button,
  ButtonLink,
  EmptyState,
  Eyebrow,
  Loading,
  Notice,
  PageHeader,
  SectionTitle,
  Select,
  StatCell,
} from "@/components/newsprint";

const TERMINAL = new Set(["won", "lost"]);

function DealCard({
  deal,
  stages,
  onMove,
  busy,
}: {
  deal: Deal;
  stages: string[];
  onMove: (dealId: string, stage: string) => void;
  busy: boolean;
}) {
  const value = deal.proposed_price || deal.estimated_value_ron || 0;
  const history = deal.stage_history ?? [];

  return (
    <article className="border-b border-ink p-4 sm:p-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={
                "label-eyebrow border px-1.5 py-0.5 " +
                (deal.stage === "won"
                  ? "border-ink bg-ink text-paper"
                  : deal.stage === "lost"
                    ? "border-editorial text-editorial"
                    : "border-ink")
              }
            >
              {stageLabel(deal.stage)}
            </span>
            <span className="font-mono text-[11px] text-stock-400">{deal.deal_id}</span>
          </div>

          <h3 className="font-display mt-2 text-xl font-bold leading-snug tracking-tight">
            {deal.project_title || "Dosar fără titlu"}
          </h3>

          <div className="font-mono mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[11px] uppercase tracking-wider text-stock-500">
            <span>Creat: {formatDate(deal.created_at)}</span>
            {deal.updated_at && <span>Modificat: {formatDate(deal.updated_at)}</span>}
            {deal.target_margin_pct != null && <span>Marjă țintă: {deal.target_margin_pct}%</span>}
          </div>

          {deal.notes && (
            <p className="font-body mt-3 border-l-2 border-divider pl-3 text-sm leading-relaxed text-stock-700">
              {deal.notes}
            </p>
          )}

          {history.length > 0 && (
            <details className="mt-3">
              <summary className="label-eyebrow text-stock-500 hover:text-ink">
                Istoric etape ({history.length})
              </summary>
              <ol className="mt-2 border-l-2 border-divider pl-3">
                {history.map((h, i) => (
                  <li key={i} className="font-mono py-1 text-[11px] text-stock-500">
                    {stageLabel(h.from) } → <span className="text-ink">{stageLabel(h.to)}</span> · {formatDate(h.at)}
                  </li>
                ))}
              </ol>
            </details>
          )}
        </div>

        <div className="flex shrink-0 flex-col gap-3 border-t border-divider pt-3 sm:w-56 sm:border-l sm:border-t-0 sm:pl-5 sm:pt-0">
          <div className="sm:text-right">
            <Eyebrow>{deal.proposed_price ? "Preț ofertat" : "Valoare estimată"}</Eyebrow>
            <p className="tabular font-display mt-1 text-2xl font-black leading-none">{formatRon(value)}</p>
          </div>
          <label className="block">
            <Eyebrow className="mb-1 text-stock-600">Mută în etapa</Eyebrow>
            <Select
              value={deal.stage}
              disabled={busy}
              onChange={(e) => e.target.value !== deal.stage && onMove(deal.deal_id, e.target.value)}
              aria-label={`Etapa dosarului ${deal.project_title}`}
            >
              {stages.map((s) => (
                <option key={s} value={s}>
                  {stageLabel(s)}
                </option>
              ))}
            </Select>
          </label>
        </div>
      </div>
    </article>
  );
}

function PipelineContent() {
  const { activeDesk, activeTenantId } = useAuth();
  const [deals, setDeals] = useState<Deal[]>([]);
  const [stages, setStages] = useState<string[]>([]);
  const [metrics, setMetrics] = useState<PipelineMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [movingDeal, setMovingDeal] = useState<string | null>(null);
  const [stageFilter, setStageFilter] = useState("all");

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // Both reads target the same tenant, and neither depends on the
      // other's result — serialising them would double the time the page
      // spends on its loading state for no benefit.
      const [pipeline, pipelineMetrics] = await Promise.all([
        fetchTenantPipeline(activeTenantId),
        fetchPipelineMetrics(activeTenantId),
      ]);
      setDeals(pipeline.deals || []);
      setStages(pipeline.stages || []);
      setMetrics(pipelineMetrics);
    } catch (e) {
      setError(e instanceof ApiError ? e.detail : "Nu s-a putut încărca pipeline-ul.");
      setDeals([]);
    } finally {
      setLoading(false);
    }
  }, [activeTenantId]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(t);
  }, [toast]);

  const handleMove = async (dealId: string, newStage: string) => {
    setMovingDeal(dealId);
    try {
      const res = await updatePipelineDeal(activeTenantId, { deal_id: dealId, new_stage: newStage });
      if (res.status === "success") {
        setToast(`Dosar mutat în „${stageLabel(newStage)}”.`);
        await load();
      } else {
        setToast(res.message || "Etapa nu a putut fi actualizată.");
      }
    } catch (e) {
      setToast(e instanceof ApiError ? e.detail : "Etapa nu a putut fi actualizată.");
    } finally {
      setMovingDeal(null);
    }
  };

  const visibleDeals =
    stageFilter === "all"
      ? deals
      : stageFilter === "active"
        ? deals.filter((d) => !TERMINAL.has(d.stage))
        : deals.filter((d) => d.stage === stageFilter);

  return (
    <main className="mx-auto w-full max-w-screen-xl flex-1 px-4 py-6 sm:py-8">
      <PageHeader
        eyebrow={`Pipeline ofertare · ${activeDesk?.name ?? ""}`}
        title="Dosare în lucru"
        standfirst="Stadiul real al dosarelor preluate din registru, cu valoare ponderată pe etapă și rate de conversie calculate din istoricul propriu de tranziții."
        action={
          <Button variant="outline" onClick={load} disabled={loading}>
            {loading ? "Se încarcă…" : "Reîncarcă"}
          </Button>
        }
      />

      {error && (
        <div className="mb-6">
          <Notice tone="alert" title="Eroare">
            {error}
          </Notice>
        </div>
      )}

      {loading ? (
        <Loading label="Se încarcă pipeline-ul" />
      ) : deals.length === 0 ? (
        <EmptyState title="Niciun dosar salvat">
          Deschideți o poziție din registrul zilnic și apăsați „Salvează în pipeline” pentru a începe urmărirea ei.
          <span className="mt-5 block">
            <ButtonLink href="/newsletter" variant="outline">
              Deschide registrul
            </ButtonLink>
          </span>
        </EmptyState>
      ) : (
        <>
          {metrics && (
            <>
              <div className="rule-grid grid grid-cols-2 border border-ink lg:grid-cols-4">
                <StatCell
                  label="Dosare active"
                  value={formatNumber(metrics.active_deals)}
                  hint={`${metrics.total_deals} în total`}
                />
                <StatCell label="Valoare activă" value={formatRon(metrics.active_pipeline_value_ron)} />
                <StatCell
                  label="Valoare ponderată"
                  value={formatRon(metrics.weighted_pipeline_value_ron)}
                  hint="Ponderată cu probabilitatea pe etapă"
                />
                <StatCell
                  label="Rată de câștig"
                  value={formatPercent(metrics.conversion_rates_pct.overall_win_rate)}
                  hint={`${metrics.won_deals} câștigate · ${metrics.lost_deals} pierdute`}
                />
              </div>

              <div className="mt-8 grid grid-cols-1 gap-8 lg:grid-cols-2">
                <section>
                  <SectionTitle note="dosare · valoare">Distribuție pe etape</SectionTitle>
                  <table className="w-full border-collapse text-left">
                    <tbody>
                      {stages.map((stage) => {
                        const cell = metrics.stage_breakdown[stage];
                        const days = metrics.average_days_in_stage[stage];
                        if (!cell) return null;
                        return (
                          <tr key={stage} className="border-b border-divider">
                            <th scope="row" className="py-2.5 pr-3 font-body text-sm font-semibold">
                              {stageLabel(stage)}
                              {days != null && (
                                <span className="font-mono ml-2 text-[10px] font-normal uppercase tracking-wider text-stock-400">
                                  {days} zile med.
                                </span>
                              )}
                            </th>
                            <td className="tabular font-mono w-14 py-2.5 text-right text-sm">{cell.count}</td>
                            <td className="tabular font-mono w-32 py-2.5 text-right text-sm text-stock-600">
                              {cell.value_ron ? formatRon(cell.value_ron) : "—"}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </section>

                <section>
                  <SectionTitle>Conversie pe pâlnie</SectionTitle>
                  <table className="w-full border-collapse text-left">
                    <tbody>
                      {[
                        ["Identificat → Ofertă depusă", metrics.conversion_rates_pct.discovery_to_bid_submitted],
                        ["Ofertă depusă → Câștigat", metrics.conversion_rates_pct.bid_submitted_to_won],
                        ["Rată de câștig globală", metrics.conversion_rates_pct.overall_win_rate],
                      ].map(([label, value]) => (
                        <tr key={label as string} className="border-b border-divider">
                          <th scope="row" className="py-2.5 pr-3 font-body text-sm font-semibold">
                            {label}
                          </th>
                          <td className="tabular font-display w-24 py-2.5 text-right text-lg font-black">
                            {formatPercent(value as number | null)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>

                  <div className="mt-4 border-l-4 border-ink px-4 py-3">
                    <Eyebrow>Metodologie</Eyebrow>
                    <p className="font-body mt-1.5 text-xs leading-relaxed text-stock-600">
                      {metrics.methodology_note}
                    </p>
                  </div>
                </section>
              </div>
            </>
          )}

          <div className="mt-10">
            <div className="mb-4 flex flex-col gap-3 border-b border-ink pb-3 sm:flex-row sm:items-end sm:justify-between">
              <h2 className="font-display text-2xl font-bold tracking-tight">
                Dosare <span className="text-stock-400">({visibleDeals.length})</span>
              </h2>
              <Select
                value={stageFilter}
                onChange={(e) => setStageFilter(e.target.value)}
                aria-label="Filtrează pe etapă"
                className="sm:w-64"
              >
                <option value="all">Toate etapele</option>
                <option value="active">Doar active</option>
                {stages.map((s) => (
                  <option key={s} value={s}>
                    {stageLabel(s)}
                  </option>
                ))}
              </Select>
            </div>

            {visibleDeals.length === 0 ? (
              <EmptyState title="Niciun dosar în această etapă" />
            ) : (
              <div className="border-t border-ink">
                {visibleDeals.map((deal) => (
                  <DealCard
                    key={deal.deal_id}
                    deal={deal}
                    stages={stages}
                    onMove={handleMove}
                    busy={movingDeal === deal.deal_id}
                  />
                ))}
              </div>
            )}
          </div>
        </>
      )}

      {toast && (
        <div
          role="status"
          aria-live="polite"
          className="fixed inset-x-4 bottom-4 z-50 border-2 border-ink bg-paper px-4 py-3 font-body text-sm shadow-[4px_4px_0_0_var(--color-ink)] sm:left-auto sm:right-6 sm:max-w-sm"
        >
          {toast}
        </div>
      )}
    </main>
  );
}

export default function PipelinePage() {
  return (
    <AuthGate
      title="Pipeline-ul este pentru abonați"
      description="Dosarele salvate și metricile de ofertare sunt legate de contul dvs."
    >
      <PipelineContent />
    </AuthGate>
  );
}
