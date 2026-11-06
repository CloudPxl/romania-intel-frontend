"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Sparkles, X } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { useActiveTender, useCopilot, useRightDrawer } from "@/context/CopilotContext";
import {
  ApiError,
  PROCEDURE_TYPE_LABELS,
  addLeadToPipeline,
  fetchTenderBrief,
  generateTenderBrief,
  triggerEmailAlert,
  type Lead,
  type PreSeapMode,
  type TenderBrief,
} from "@/lib/api";
import { formatDate, formatNumber } from "@/lib/format";
import { PRE_SEAP_FOIA_PRESETS, analyticsHref, draftingHref, foiaHref } from "@/lib/toolLinks";
import { Button, Disclosure } from "@/components/newsprint";
import { daysLeft, deadlineLabel, deadlineTone } from "@/components/registry";
import AuthorityProfilePanel from "@/components/AuthorityProfilePanel";
import ProcedureThresholdCard from "@/components/ProcedureThresholdCard";

// Matches --duration-base in globals.css. The exit keyframes are that
// long; onClose (which actually unmounts this component, via the
// caller's `{selectedLead && <LeadDossierPanel .../>}`) has to wait for
// them to finish, since a conditionally-rendered element has nothing
// left to animate once React has already removed it from the DOM.
const CLOSE_ANIMATION_MS = 200;

/**
 * The right-side "Dosar strategic" slide-over — extracted out of Căutare
 * Avansată so Prima Pagina can open the same panel in place, without
 * navigating there first. Fully self-contained (its own busyAction/toast
 * state, reads the user/preferences it needs from useAuth itself) so any
 * page can drop it in with just a lead and a close handler.
 */
/**
 * The shared AI brief for this tender. Reading one is free — it was paid for
 * once, by the nightly batch or by whoever generated it first — so it loads
 * on open; generating one spends one of the user's AI documents and then
 * serves everyone after them. The legal regime beside it is computed from
 * the law, never by the model.
 */
function TenderBriefSection({ sourceId }: { sourceId: string }) {
  const [brief, setBrief] = useState<TenderBrief | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    fetchTenderBrief(sourceId)
      .then((b) => mounted && setBrief(b))
      .catch(() => mounted && setBrief(null));
    return () => {
      mounted = false;
    };
  }, [sourceId]);

  const handleGenerate = async () => {
    setBusy(true);
    setError(null);
    try {
      const b = await generateTenderBrief(sourceId);
      setBrief(b);
      if (b.status !== "ready") setError(b.ai_quota || "Brief-ul nu a putut fi generat acum.");
    } catch (e) {
      setError(e instanceof ApiError ? e.detail : "Brief-ul nu a putut fi generat acum.");
    } finally {
      setBusy(false);
    }
  };

  if (!brief) return null;
  const regime = brief.legal_regime;

  return (
    <section className="rounded-xl border border-line-strong bg-paper p-5">
      <div className="mb-2 flex items-center gap-2">
        <Sparkles size={16} className="text-accent" aria-hidden />
        <h3 className="text-[16px] font-semibold">Sinteza AI</h3>
        <span className="text-[13px] text-stock-400">{brief.status === "ready" ? "partajată · fără credit" : "1 credit"}</span>
      </div>
      {regime?.procedure_name && !regime.not_applicable && (
        <p className="tabular mb-2 text-[13px] leading-5 text-stock-500">
          {regime.applicable_law} · {regime.procedure_name} ·{" "}
          {regime.cnsc_deadline_days ? `contestație CNSC ${regime.cnsc_deadline_days} zile` : "contestare în instanță (L554/2004)"}
          {regime.cautiune && ` · cauțiune ${formatNumber(regime.cautiune.pre_submission_ron)} lei`}
        </p>
      )}
      {regime?.thresholds && !regime.not_applicable && <ProcedureThresholdCard meta={regime} compact />}
      {brief.status === "ready" && brief.brief ? (
        <>
          <p className="whitespace-pre-wrap text-[15px] leading-6 text-stock-600">{brief.brief}</p>
          <p className="mt-2 text-[13px] text-stock-400">Generată cu AI din datele publicate — verificați în documentația oficială.</p>
        </>
      ) : brief.status === "pending" ? (
        <p className="text-[15px] text-stock-500">În pregătire în lotul de noapte — disponibilă în câteva ore.</p>
      ) : (
        <Button variant="outline" onClick={handleGenerate} disabled={busy} fullWidth>
          {busy ? "Se generează…" : "Generează sinteza AI (1 credit)"}
        </Button>
      )}
      {error && <p className="mt-2 text-[14px] text-warning">{error}</p>}
    </section>
  );
}

/**
 * A permit, an environmental agreement, a council decision, a budget or a
 * programme: the investment exists, the procedure does not. Instead of the
 * price tools (80% threshold, cauțiune, guarantees — none of which exists
 * before the tender is published), the dossier says who issued it, where the
 * investment stands, and opens the Legea 544/2001 request for the
 * feasibility study, the indicators and the procurement calendar.
 */
function PreSeapSection({ mode, onRequest }: { mode: PreSeapMode; onRequest: () => void }) {
  const rows: [string, string | null][] = [
    ["Tip semnal", mode.signal_label],
    ["Emitent", mode.issuing_authority],
    ["Beneficiar", mode.beneficiary_authority],
    ["Stadiul investiției", mode.investment_stage],
  ];
  return (
    <section className="rounded-xl border border-warning/25 bg-warning-soft p-5">
      <p className="label-eyebrow text-warning">Semnal pre-SEAP — încă nu este licitație</p>
      <dl className="mt-3 grid grid-cols-1 gap-x-4 gap-y-2 sm:grid-cols-2">
        {rows
          .filter(([, v]) => v)
          .map(([label, value]) => (
            <div key={label}>
              <dt className="text-[13px] text-stock-500">{label}</dt>
              <dd className="text-[15px] leading-snug text-ink">{value}</dd>
            </div>
          ))}
      </dl>
      <p className="mt-3 text-[15px] leading-6 text-stock-600">{mode.next_step}</p>
      <div className="mt-4">
        <Button onClick={onRequest} fullWidth>
          Cerere informații interes public — Legea 544/2001
        </Button>
      </div>
      <p className="mt-3 text-[13px] leading-5 text-stock-500">{mode.not_applicable}</p>
    </section>
  );
}

/** For a lead from a slimmer projection that carries the kind but not the mode. */
const DEFAULT_PRE_SEAP: PreSeapMode = {
  signal_type: null,
  signal_label: "Semnal de investiție (pre-SEAP)",
  issuing_authority: null,
  beneficiary_authority: null,
  investment_stage: null,
  next_step:
    "Cereți autorității, în temeiul Legii nr. 544/2001, studiul de fezabilitate / DALI, indicatorii tehnico-economici aprobați și calendarul estimat al procedurii — înainte ca licitația să apară în SEAP.",
  foia_presets: PRE_SEAP_FOIA_PRESETS,
  not_applicable:
    "Semnal pre-SEAP: nu există încă o procedură de atribuire, deci nici prag de 80%, cauțiune CNSC sau garanții.",
};

export default function LeadDossierPanel({ lead, onClose }: { lead: Lead; onClose: () => void }) {
  const { user } = useAuth();
  const router = useRouter();
  const { ask } = useCopilot();
  // While this panel is open, "acest dosar" in the copilot means this one.
  useActiveTender(lead.source_id, lead.project_title);
  useRightDrawer();
  const preSeap: PreSeapMode | null =
    lead.record_kind === "PRE_TENDER_SIGNAL"
      ? { ...DEFAULT_PRE_SEAP, beneficiary_authority: lead.entity_name ?? null, ...(lead.pre_seap ?? {}) }
      : null;
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  // Plays the exit animation, then unmounts once it's done — closing was
  // previously an instant disappearance, since the caller's conditional
  // render gives the panel nothing to animate against once it's gone.
  const [closing, setClosing] = useState(false);
  const [authorityOpen, setAuthorityOpen] = useState(false);
  const requestClose = () => {
    if (closing) return;
    setClosing(true);
    setTimeout(onClose, CLOSE_ANIMATION_MS);
  };

  // Every tool fetches the full record by source_id; the extra params are
  // a fallback for a lead the database doesn't hold.
  const fallback = {
    project_title: lead.project_title || "",
    authority_name: lead.entity_name || "",
    county: lead.county || "",
    category: lead.category || "",
    budget: String(lead.financial_value_ron || ""),
  };

  const handleSaveToPipeline = async () => {
    setBusyAction("pipeline");
    try {
      const res = await addLeadToPipeline(lead);
      if (res.status === "success") {
        // Saying so matters: without a database the deal lives in process
        // memory and disappears on the next restart, and the user would
        // otherwise find an empty pipeline with no explanation.
        setToast(
          res.persisted === false
            ? "Dosar salvat temporar — baza de date nu răspunde, dosarul nu va fi păstrat."
            : "Dosar salvat în pipeline."
        );
      } else if (res.status === "already_saved") {
        setToast("Acest dosar este deja în pipeline.");
      } else {
        setToast(res.message || "Nu s-a putut salva dosarul.");
      }
    } catch (e) {
      setToast(e instanceof ApiError ? e.detail : "Nu s-a putut salva dosarul.");
    } finally {
      setBusyAction(null);
    }
  };

  const handleSendEmailAlert = async () => {
    setBusyAction("email");
    try {
      // By id, and always to the account's own address: the server builds
      // the e-mail from its record and names the recipient it used.
      const res = await triggerEmailAlert(lead.source_id);
      setToast(
        res.status === "success"
          ? `Dosarul a fost trimis pe ${res.recipient}.`
          : "Serverul nu are configurat un canal de email — mesajul nu a fost trimis."
      );
    } catch (e) {
      setToast(e instanceof ApiError ? e.detail : "Nu s-a putut expedia alerta.");
    } finally {
      setBusyAction(null);
    }
  };

  const days = daysLeft(lead.action_deadline);
  const value = lead.financial_value_ron || 0;
  const facts: { label: string; value: React.ReactNode; sub?: string; tone?: string }[] = [
    { label: preSeap ? "Valoare investiție" : "Valoare estimată", value: value ? `${formatNumber(Math.round(value))} lei` : "nepublicată", sub: "fără TVA" },
    preSeap
      ? { label: "Sursă finanțare", value: lead.funding_source || "nespecificată" }
      : lead.procedure_type === "cumparare_directa"
        ? { label: "Prag 80% · art. 210", value: "nu se aplică", sub: "achiziție directă — nu e procedură de atribuire" }
        : { label: "Prag 80% · art. 210", value: value ? `${formatNumber(Math.round(value * 0.8))} lei` : "—", sub: "sub el se cere justificarea" },
    { label: "Termen depunere", value: lead.action_deadline ? formatDate(lead.action_deadline) : "nespecificat", sub: deadlineLabel(days), tone: deadlineTone(days) },
    { label: "Publicat", value: formatDate(lead.published_date), sub: lead.source_type || undefined },
    { label: "Procedură", value: lead.procedure_type ? PROCEDURE_TYPE_LABELS[lead.procedure_type] ?? lead.procedure_type : "nespecificată", sub: lead.award_criterion ? `criteriu: ${lead.award_criterion}` : undefined },
    { label: "Scor proiect", value: lead.opportunity_score != null ? `${lead.opportunity_score} / 10` : "—", sub: lead.match?.is_match ? "se potrivește profilului" : undefined },
  ];

  return (
    <>
      <div className="fixed inset-0 z-50">
        <div
          className={"absolute inset-0 bg-overlay " + (closing ? "animate-[fade-out_var(--duration-base)_both]" : "animate-[fade-in_var(--duration-base)_both]")}
          onClick={requestClose}
          aria-hidden="true"
        />
        <aside
          role="dialog"
          aria-modal="true"
          aria-label="Dosarul licitației"
          className={
            "absolute inset-y-0 right-0 flex w-full max-w-[560px] flex-col bg-canvas shadow-float " +
            (closing
              ? "animate-[slide-over-right-out_var(--duration-base)_var(--ease-glide)_both]"
              : "animate-[slide-over-right_var(--duration-base)_var(--ease-glide)_both]")
          }
        >
          <div className="flex h-16 shrink-0 items-center gap-3 border-b border-divider bg-paper px-5">
            <span className={"label-eyebrow " + (preSeap ? "text-warning" : "text-accent")}>{preSeap ? "Semnal pre-SEAP" : "Dosar"}</span>
            <span className="tabular truncate text-[13px] text-stock-400">{lead.source_id}</span>
            <span className="flex-1" />
            <button onClick={requestClose} aria-label="Închide dosarul" className="flex h-10 w-10 items-center justify-center rounded-lg text-stock-500 hover:bg-surface-2 hover:text-ink">
              <X size={20} />
            </button>
          </div>

          <div className="flex flex-1 flex-col gap-5 overflow-y-auto px-5 pb-8 pt-6 [&>*]:shrink-0">
            <div>
              <h2 className="text-xl font-semibold leading-7 tracking-[-0.01em] text-ink">{lead.project_title}</h2>
              <p className="mt-1.5 text-[15px] leading-6 text-stock-500">
                {lead.entity_name ? (
                  <button
                    onClick={() => setAuthorityOpen(true)}
                    className="font-medium text-ink underline decoration-line-strong underline-offset-4 hover:text-accent hover:decoration-current"
                    title="Profilul autorității: atribuiri reale, concentrare, câștigători"
                  >
                    {lead.entity_name}
                  </button>
                ) : null}
                {lead.authority_cui && <span className="tabular"> · CUI {lead.authority_cui}</span>}
                {lead.county && lead.county !== "Necunoscut" ? ` · ${lead.county}` : ""}
                {lead.cpv_code && <span className="tabular"> · CPV {lead.cpv_code}</span>}
              </p>
            </div>

            <div className="grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-divider bg-divider">
              {facts.map((f) => (
                <div key={f.label} className="bg-paper px-4 py-3">
                  <div className="text-[13px] text-stock-500">{f.label}</div>
                  <div className="tabular mt-0.5 text-[15px] font-medium text-ink">{f.value}</div>
                  {f.sub && <div className={"text-[13px] " + (f.tone || "text-stock-400")}>{f.sub}</div>}
                </div>
              ))}
            </div>

            {lead.metadata?.seap_cross_reference && (
              <p className="text-[13px] text-stock-500">
                Posibilă corespondență SEAP · bază:{" "}
                {lead.metadata.seap_cross_reference.basis
                  .map((b) => ({ cpv_prefix: "CPV", value_within_tolerance: "valoare", buyer_name: "autoritate" }[b]))
                  .join(", ")}
              </p>
            )}

            {preSeap && <PreSeapSection mode={preSeap} onRequest={() => router.push(foiaHref(lead.source_id, preSeap.foia_presets, fallback))} />}

            {!preSeap && (
              <div className="flex flex-col gap-2">
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-[1fr_auto]">
                  <Button onClick={() => router.push(draftingHref(lead.source_id, "clarificari", fallback))}>Redactează clarificarea · art. 160</Button>
                  <Button variant="outline" onClick={handleSaveToPipeline} disabled={busyAction === "pipeline"}>
                    {busyAction === "pipeline" ? "Se salvează…" : "Salvează în pipeline"}
                  </Button>
                </div>
                <Disclosure summary={<span>Instrumente de ofertare <span className="font-normal text-stock-500">· caiet, preț, propunere, piață</span></span>}>
                <div className="grid grid-cols-2 gap-2 py-1">
                  <Button variant="outline" onClick={() => router.push(analyticsHref(lead.source_id, "caiet", fallback))}>
                    Scanează caietul
                  </Button>
                  <Button variant="outline" onClick={() => router.push(analyticsHref(lead.source_id, "win", fallback))}>
                    Verifică prețul
                  </Button>
                  <Button variant="outline" onClick={() => router.push(draftingHref(lead.source_id, "propunere", fallback))}>
                    Propunere tehnică
                  </Button>
                  <Button variant="outline" onClick={() => router.push(analyticsHref(lead.source_id, "competitor", fallback))}>
                    Profil de piață
                  </Button>
                </div>
                </Disclosure>
              </div>
            )}

            {lead.source_id && <TenderBriefSection sourceId={lead.source_id} />}

            {(lead.sales_pitch_angle || lead.executive_summary) && (
              <section className="rounded-xl border border-line-strong bg-paper p-5">
                {lead.executive_summary && (
                  <>
                    <h3 className="text-[16px] font-semibold">Din anunț</h3>
                    <p className="mt-1.5 text-[15px] leading-6 text-stock-600">{lead.executive_summary}</p>
                  </>
                )}
                {lead.sales_pitch_angle && (
                  <>
                    <h3 className={"text-[16px] font-semibold" + (lead.executive_summary ? " mt-4" : "")}>Poziționare tehnică</h3>
                    <p className="mt-1.5 text-[15px] leading-6 text-stock-600">{lead.sales_pitch_angle}</p>
                  </>
                )}
              </section>
            )}

            <div className="flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-divider pt-4 text-[14px]">
              {preSeap && (
                <button type="button" onClick={handleSaveToPipeline} disabled={busyAction === "pipeline"} className="min-h-9 font-medium text-accent hover:underline disabled:opacity-60">
                  {busyAction === "pipeline" ? "Se salvează…" : "Salvează în pipeline"}
                </button>
              )}
              <button type="button" onClick={handleSendEmailAlert} disabled={busyAction === "email"} className="min-h-9 font-medium text-accent hover:underline disabled:opacity-60">
                {busyAction === "email" ? "Se trimite…" : "Trimite-mi pe email"}
              </button>
              <button type="button" onClick={() => ask()} className="inline-flex min-h-9 items-center gap-1.5 font-medium text-accent hover:underline">
                <Sparkles size={15} aria-hidden /> Întreabă Copilotul
              </button>
            </div>

            {lead.source_url && (
              <a href={lead.source_url} target="_blank" rel="noopener noreferrer" className="text-center text-[15px] font-medium text-accent underline underline-offset-4">
                Anunțul oficial în sursă →
              </a>
            )}
            {!user && <p className="text-center text-[14px] text-stock-500">Autentificați-vă pentru acțiuni.</p>}
          </div>
        </aside>
      </div>

      {authorityOpen && <AuthorityProfilePanel cui={lead.authority_cui} name={lead.entity_name} onClose={() => setAuthorityOpen(false)} />}

      {toast && (
        <div role="status" aria-live="polite" className="fixed bottom-24 left-1/2 z-[60] max-w-[calc(100%-2rem)] -translate-x-1/2 rounded-lg bg-cerneala px-4 py-2.5 text-[14px] text-cerneala-text shadow-float">
          {toast}
        </div>
      )}
    </>
  );
}
