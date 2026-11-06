"use client";

import Link from "next/link";
import { fetchOpsOverview, type OpsMetric, type OpsOverview } from "@/lib/api";
import { Badge, Disclosure, Loading, Notice } from "@/components/newsprint";
import OpsShell, { MetricGrid, RefreshBar, SectionHead, Table, ago, formatDateTime, useCan, usePolling } from "@/components/ops/OpsShell";
import AuditList from "@/components/ops/AuditList";
import { HEALTH_STATES, PLAN_NAMES, PROFORMA_STATUS } from "@/components/ops/labels";

/** Figures that need attention when they are not zero. */
function attention(m: OpsMetric): "warning" | "negative" | undefined {
  if (typeof m.value !== "number" || m.value === 0) return undefined;
  if (["stuck_ticks", "docs_stuck", "sources_open"].includes(m.key)) return "negative";
  if (["tick_errors_24h", "docs_failed_24h", "sources_degraded", "ai_not_ok_today", "accounts_suspended"].includes(m.key)) return "warning";
  return undefined;
}

function Unavailable({ detail }: { detail?: string }) {
  return <Notice tone="warning" title="Bloc indisponibil">{detail || "Datele nu au putut fi citite."}</Notice>;
}

function Overview() {
  const { data, error, loadedAt, busy, refresh } = usePolling<OpsOverview>(fetchOpsOverview, 60_000);
  const canAudit = useCan("audit.view");
  const canErrors = useCan("health.view_errors");

  if (!data) return error ? <Notice tone="alert" title="Situația nu a putut fi încărcată">{error}</Notice> : <Loading label="Se încarcă situația" />;
  const { health, usage } = data;
  const lastTick = health.ingestion.data?.last_completed_at ?? null;
  // Measured against the server's clock, not the browser's.
  const tickAgeMin = lastTick ? (new Date(data.generated_at).getTime() - new Date(lastTick).getTime()) / 60000 : Infinity;
  const sources = health.sources.data?.items ?? [];
  const problemSources = sources.filter((s) => s.circuit_state !== "closed" || (s.health_state && s.health_state !== "HEALTHY"));

  return (
    <>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-[28px] font-semibold leading-[34px] tracking-[-0.02em] text-ink">Situația platformei</h1>
          <p className="mt-1 text-[15px] text-stock-500">
            Ultima colectare încheiată: <b className="font-semibold text-ink">{ago(lastTick)}</b>
            {lastTick ? ` (${formatDateTime(lastTick)})` : ""}.{" "}
            {tickAgeMin > 45 ? <Badge tone="negative">Colectarea pare oprită</Badge> : <Badge tone="positive">Colectarea rulează</Badge>}
          </p>
        </div>
        <RefreshBar loadedAt={loadedAt} busy={busy} onRefresh={refresh} every="la 60 s" />
      </div>
      {error && <div className="mt-3"><Notice tone="warning">Ultima reîmprospătare a eșuat: {error}. Se afișează datele anterioare.</Notice></div>}

      <SectionHead title="Ce cere atenție acum" note="Calculat din cifrele de mai jos; nimic estimat." />
      <AttentionList data={data} problemCount={problemSources.length} tickAgeMin={tickAgeMin} />

      <SectionHead title="Sănătatea sistemului" note="Colectare, surse, procesarea documentelor, AI." />
      <div className="space-y-4">
        {health.ingestion.available ? <MetricGrid metrics={health.ingestion.data!.metrics} toneFor={attention} /> : <Unavailable detail={health.ingestion.detail} />}
        {health.sources.available ? <MetricGrid metrics={health.sources.data!.metrics} toneFor={attention} /> : <Unavailable detail={health.sources.detail} />}
        {health.documents.available ? <MetricGrid metrics={health.documents.data!.metrics} toneFor={attention} /> : <Unavailable detail={health.documents.detail} />}
        {health.ai.available ? <MetricGrid metrics={health.ai.data!.metrics} toneFor={attention} /> : <Unavailable detail={health.ai.detail} />}
      </div>

      {problemSources.length > 0 && (
        <>
          <SectionHead title={`Surse cu probleme (${problemSources.length})`} note={canErrors ? "Textul erorii este afișat integral." : "Textul erorilor este vizibil doar rolurilor tehnice."} />
          <Table head={["Sursă", "Stare", "Ultimul succes", "Eșecuri la rând", "Ultima eroare"]}>
            {problemSources.map((s) => (
              <tr key={s.source_name}>
                <td className="px-3 py-2.5 font-medium text-ink">{s.source_name}</td>
                <td className="px-3 py-2.5">
                  {s.circuit_state !== "closed" ? <Badge tone="negative">Oprită</Badge> : <Badge tone="warning">{HEALTH_STATES[s.health_state || ""] || s.health_state}</Badge>}
                </td>
                <td className="tabular px-3 py-2.5 text-stock-600">{ago(s.last_success_at)}</td>
                <td className="tabular px-3 py-2.5 text-stock-600">{s.consecutive_failures ?? 0}</td>
                <td className="max-w-[360px] break-words px-3 py-2.5 font-mono text-[12px] text-stock-500">{s.last_error || s.last_failure_kind || "—"}</td>
              </tr>
            ))}
          </Table>
        </>
      )}

      {usage && (
        <>
          <SectionHead title="Conturi și utilizare" note="Doar evenimente înregistrate efectiv. Ce nu se măsoară este listat mai jos." />
          {usage.accounts.available ? <MetricGrid metrics={usage.accounts.data!} toneFor={attention} /> : <Unavailable detail={usage.accounts.detail} />}
          <div className="mt-4">{usage.work.available ? <MetricGrid metrics={usage.work.data!} /> : <Unavailable detail={usage.work.detail} />}</div>

          <SectionHead title="Comercial" note="Abonamente, acces din coduri, proforme. Accesul din coduri nu este venit." />
          {usage.commercial.available ? (
            <>
              <MetricGrid metrics={usage.commercial.data!.metrics} />
              <div className="mt-3 grid gap-3 text-[14px] text-stock-600 md:grid-cols-3">
                <Breakdown title="Abonamente active pe plan" rows={usage.commercial.data!.subscriptions_by_plan.map((r) => [PLAN_NAMES[r.plan || ""] || r.plan || "—", r.n])} />
                <Breakdown title="Acces din coduri pe plan" rows={usage.commercial.data!.code_grants_by_plan.map((r) => [PLAN_NAMES[r.plan || ""] || r.plan || "—", r.n])} />
                <Breakdown title="Proforme pe status" rows={usage.commercial.data!.proformas_by_status.map((r) => [PROFORMA_STATUS[r.status] || r.status, r.n])} />
              </div>
            </>
          ) : <Unavailable detail={usage.commercial.detail} />}

          <div className="mt-6">
            <Disclosure summary={`Ce nu se măsoară încă (${usage.not_measured.length})`}>
              <ul className="space-y-2">
                {usage.not_measured.map((n) => (
                  <li key={n.label}><b className="font-semibold text-ink">{n.label}.</b> {n.reason}</li>
                ))}
              </ul>
            </Disclosure>
          </div>
        </>
      )}

      {health.undelivered_alerts.available && (health.undelivered_alerts.data?.length ?? 0) > 0 && (
        <>
          <SectionHead title="Alerte de operator nelivrate" note="Alerte care nu au ajuns pe email sau webhook; ultimele 10." />
          <ul className="divide-y divide-divider rounded-xl border border-line-strong bg-paper">
            {health.undelivered_alerts.data!.map((a) => (
              <li key={a.id} className="px-4 py-3 text-[14px]">
                <span className="tabular mr-2 text-stock-400">{formatDateTime(a.created_at)}</span>
                <span className="whitespace-pre-wrap break-words text-stock-600">{a.message}</span>
              </li>
            ))}
          </ul>
        </>
      )}

      {canAudit && data.recent_audit && (
        <>
          <SectionHead title="Acțiuni recente în consolă">
            <Link href="/ops/audit" className="text-[14px] font-medium text-accent hover:underline">Tot jurnalul →</Link>
          </SectionHead>
          <AuditList events={data.recent_audit} compact />
        </>
      )}
      <p className="tabular mt-8 text-[12px] text-stock-400">Date generate de server la {formatDateTime(data.generated_at)}.</p>
    </>
  );
}

function AttentionList({ data, problemCount, tickAgeMin }: { data: OpsOverview; problemCount: number; tickAgeMin: number }) {
  const items: { tone: "negative" | "warning"; text: string; href?: string }[] = [];
  const all = [
    ...(data.health.ingestion.data?.metrics ?? []),
    ...(data.health.documents.data?.metrics ?? []),
    ...(data.health.ai.data?.metrics ?? []),
  ];
  if (tickAgeMin > 45) items.push({ tone: "negative", text: "Nicio colectare încheiată în ultimele 45 de minute (ciclul normal: 30 min). Verificați serviciul ro-intel-engine." });
  for (const m of all) {
    const tone = attention(m);
    if (tone) items.push({ tone, text: `${m.label}: ${m.value} (${m.window}).` });
  }
  if (problemCount) items.push({ tone: "warning", text: `${problemCount} surse oprite sau degradate — vezi tabelul de mai jos.` });
  const alerts = data.health.undelivered_alerts.data?.length ?? 0;
  if (alerts) items.push({ tone: "warning", text: `${alerts} alerte de operator nu au ajuns pe niciun canal.` });
  const unavailable = Object.values(data.health).filter((b) => !b.available).length;
  if (unavailable) items.push({ tone: "warning", text: `${unavailable} blocuri de date nu au putut fi citite (vezi mai jos).` });

  if (!items.length) {
    return <Notice title="Nimic de rezolvat">Colectarea rulează, nicio sursă oprită, nicio extragere blocată, niciun apel AI eșuat azi.</Notice>;
  }
  return (
    <ul className="space-y-2">
      {items.map((i, n) => (
        <li key={n} className="flex items-start gap-2 rounded-lg border border-divider bg-paper px-3 py-2.5 text-[14px] text-stock-600">
          <Badge tone={i.tone}>{i.tone === "negative" ? "Urgent" : "De verificat"}</Badge>
          <span className="pt-0.5">{i.text}</span>
        </li>
      ))}
    </ul>
  );
}

function Breakdown({ title, rows }: { title: string; rows: [string, number][] }) {
  return (
    <div className="rounded-xl border border-line-strong bg-paper p-4">
      <p className="text-[13px] font-semibold text-ink">{title}</p>
      {rows.length ? (
        <ul className="mt-2 space-y-1">
          {rows.map(([k, v]) => (
            <li key={k} className="flex justify-between gap-3"><span>{k}</span><span className="tabular text-ink">{v}</span></li>
          ))}
        </ul>
      ) : <p className="mt-2 text-stock-400">Niciunul.</p>}
    </div>
  );
}

export default function OpsHome() {
  return (
    <OpsShell>
      <Overview />
    </OpsShell>
  );
}
