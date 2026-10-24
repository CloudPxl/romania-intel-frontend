"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Sparkles, X } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { useActiveTender, useCopilot } from "@/context/CopilotContext";
import {
  ApiError,
  PROCEDURE_TYPE_LABELS,
  addLeadToPipeline,
  fetchTenderBrief,
  generateTenderBrief,
  triggerEmailAlert,
  type Lead,
  type TenderBrief,
} from "@/lib/api";
import { formatDate, formatLeadValue, formatNumber } from "@/lib/format";
import { analyticsHref, draftingHref } from "@/lib/toolLinks";
import { Button, Eyebrow } from "@/components/newsprint";
import AuthorityProfilePanel from "@/components/AuthorityProfilePanel";

// Matches --duration-base in globals.css. The exit keyframes are that
// long; onClose (which actually unmounts this component, via the
// caller's `{selectedLead && <LeadDossierPanel .../>}`) has to wait for
// them to finish, since a conditionally-rendered element has nothing
// left to animate once React has already removed it from the DOM.
const CLOSE_ANIMATION_MS = 320;

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
    <div className="mt-5">
      <Eyebrow className="mb-1.5">Brief AI al licitației</Eyebrow>
      {regime?.procedure_name && (
        <p className="font-mono mb-2 text-[11px] text-stock-500">
          {regime.applicable_law} · {regime.procedure_name} ·{" "}
          {regime.cnsc_deadline_days ? `contestație CNSC ${regime.cnsc_deadline_days} zile` : "contestare în instanță (L554/2004)"}
          {regime.cautiune && ` · cauțiune ${formatNumber(regime.cautiune.pre_submission_ron)} lei`}
        </p>
      )}
      {brief.status === "ready" && brief.brief ? (
        <div className="neu-pressed rounded-2xl bg-paper px-4 py-3">
          <p className="font-body whitespace-pre-wrap text-sm leading-relaxed text-stock-600">{brief.brief}</p>
          <p className="font-mono mt-2 text-[10px] uppercase tracking-widest text-stock-400">
            Generat cu AI din datele publicate — verificați în documentația oficială
          </p>
        </div>
      ) : brief.status === "pending" ? (
        <p className="font-body text-sm text-stock-500">În pregătire în lotul de noapte — disponibil în câteva ore.</p>
      ) : (
        <Button variant="outline" onClick={handleGenerate} disabled={busy} fullWidth>
          {busy ? "Se generează brief-ul…" : "Generează brief AI (1 credit)"}
        </Button>
      )}
      {error && <p className="font-body mt-1.5 text-xs text-warning">{error}</p>}
    </div>
  );
}

export default function LeadDossierPanel({ lead, onClose }: { lead: Lead; onClose: () => void }) {
  const { user, preferences } = useAuth();
  const router = useRouter();
  const { ask } = useCopilot();
  // While this panel is open, "acest dosar" in the copilot means this one.
  useActiveTender(lead.source_id, lead.project_title);
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
    const recipient = preferences?.notification_email || user?.email;
    if (!recipient) {
      setToast("Configurați un email de notificare în Setări cont.");
      return;
    }
    setBusyAction("email");
    try {
      // By id: the server builds the e-mail from its own record, so the
      // link in it always opens this dossier.
      const res = await triggerEmailAlert(lead.source_id, recipient);
      setToast(
        res.status === "success"
          ? `Alertă expediată către ${recipient}.`
          : "Serverul nu are configurat un canal SMTP — alerta nu a fost trimisă."
      );
    } catch (e) {
      setToast(e instanceof ApiError ? e.detail : "Nu s-a putut expedia alerta.");
    } finally {
      setBusyAction(null);
    }
  };

  return (
    <>
      <div className="fixed inset-0 z-50">
        <div
          className={
            "absolute inset-0 bg-ink/50 backdrop-blur-sm " +
            (closing
              ? "animate-[fade-out_var(--duration-base)_var(--ease-glide)_both]"
              : "animate-[fade-in_var(--duration-base)_var(--ease-glide)_both]")
          }
          onClick={requestClose}
          aria-hidden="true"
        />
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Dosar strategic"
          className={
            "absolute inset-y-0 right-0 flex w-full max-w-xl flex-col overflow-y-auto bg-paper " +
            (closing
              ? "animate-[slide-over-right-out_var(--duration-base)_var(--ease-glide)_both]"
              : "animate-[slide-over-right_var(--duration-base)_var(--ease-glide)_both]")
          }
        >
          <div className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-divider bg-paper/95 p-4 backdrop-blur sm:p-6">
            <div className="min-w-0">
              <Eyebrow className="text-editorial">Dosar strategic · {lead.source_id}</Eyebrow>
              <h2 className="font-display mt-2 text-xl font-semibold leading-tight tracking-tight sm:text-2xl">
                {lead.project_title}
              </h2>
              <p className="font-body mt-1 text-sm text-stock-600">
                {lead.entity_name ? (
                  <button
                    onClick={() => setAuthorityOpen(true)}
                    className="underline decoration-divider underline-offset-4 transition-colors hover:text-editorial"
                    title="Profilul autorității: atribuiri reale, concentrare, câștigători"
                  >
                    {lead.entity_name}
                  </button>
                ) : null}
                {lead.county ? ` · ${lead.county}` : ""}
              </p>
            </div>
            <button
              onClick={requestClose}
              aria-label="Închide dosarul"
              className="-mr-1 -mt-1 flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-stock-500 transition-all duration-300 hover:neu-pressed-sm hover:text-ink"
            >
              <X size={20} strokeWidth={1.5} />
            </button>
          </div>

          <div className="flex-1 p-4 sm:p-6">
            <div className="grid grid-cols-2 divide-x divide-divider neu-pressed overflow-hidden rounded-2xl bg-paper">
              <div className="p-4">
                <Eyebrow>Buget estimat</Eyebrow>
                <p
                  className={
                    "mt-1 leading-snug " +
                    (lead.financial_value_ron
                      ? "tabular font-display text-xl font-semibold leading-none"
                      : "font-body text-sm italic text-stock-400")
                  }
                >
                  {formatLeadValue(lead.financial_value_ron)}
                </p>
              </div>
              <div className="p-4">
                <Eyebrow>Sursă finanțare</Eyebrow>
                <p className="font-display mt-1 text-base font-semibold leading-tight">
                  {lead.funding_source || "Nespecificat"}
                </p>
              </div>
            </div>

            <div className="scroll-x mt-5">
              <table className="w-full min-w-[26rem] neu-pressed overflow-hidden rounded-2xl bg-paper text-left font-mono text-xs">
                <tbody>
                  {[
                    ["Data publicării", formatDate(lead.published_date)],
                    ["Termen dialog tehnic", lead.action_deadline || "Nespecificat"],
                    ["CUI autoritate", lead.authority_cui || "Nepublicat"],
                    [
                      "Tip procedură",
                      lead.procedure_type
                        ? PROCEDURE_TYPE_LABELS[lead.procedure_type] ?? lead.procedure_type
                        : "Nespecificat",
                    ],
                    // "Nepublicat" rather than "Niciunul": no live scraper
                    // has found e-licitatie.ro's per-notice endpoint for
                    // this yet, so an empty value means we don't have it —
                    // not that the procedure lacks a criterion.
                    ["Criteriu de atribuire", lead.award_criterion || "Nepublicat"],
                    ["Cod CPV", lead.cpv_code || "—"],
                    ["Registru sursă", lead.source_type || "—"],
                    ["Scor proiect", lead.opportunity_score != null ? `${lead.opportunity_score} / 10` : "—"],
                  ].map(([label, value]) => (
                    <tr key={label} className="border-b border-divider last:border-b-0">
                      <th
                        scope="row"
                        className="w-44 border-r border-divider px-3 py-2.5 font-sans text-[10px] font-semibold uppercase tracking-widest text-stock-500"
                      >
                        {label}
                      </th>
                      <td className="px-3 py-2.5">{value}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {lead.metadata?.seap_cross_reference && (
              <p className="font-mono mt-2 text-[11px] uppercase tracking-widest text-stock-500">
                Posibilă corespondență SEAP · bază:{" "}
                {lead.metadata.seap_cross_reference.basis
                  .map((b) => ({ cpv_prefix: "CPV", value_within_tolerance: "valoare", buyer_name: "autoritate" }[b]))
                  .join(", ")}
              </p>
            )}

            {lead.source_id && <TenderBriefSection sourceId={lead.source_id} />}

            {lead.sales_pitch_angle && (
              <div className="neu-pressed mt-5 rounded-r-lg border-l-2 border-editorial bg-editorial-soft px-4 py-3">
                <Eyebrow className="text-editorial">Poziționare tehnică</Eyebrow>
                <p className="font-body mt-1.5 text-sm leading-relaxed">{lead.sales_pitch_angle}</p>
              </div>
            )}

            {lead.executive_summary && (
              <div className="mt-5">
                <Eyebrow className="mb-1.5">Sinteză</Eyebrow>
                <p className="font-body mt-2 text-sm leading-relaxed text-stock-600">{lead.executive_summary}</p>
              </div>
            )}

            <div className="mt-6">
              <Eyebrow className="mb-3">Acțiuni</Eyebrow>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                <Button onClick={handleSaveToPipeline} disabled={busyAction === "pipeline"}>
                  {busyAction === "pipeline" ? "Se salvează…" : "Salvează în pipeline"}
                </Button>
                <Button variant="outline" onClick={handleSendEmailAlert} disabled={busyAction === "email"}>
                  {busyAction === "email" ? "Se expediază…" : "Trimite alertă email"}
                </Button>
                <Button
                  variant="outline"
                  onClick={() => router.push(draftingHref(lead.source_id, "propunere", fallback))}
                >
                  Propunere tehnică
                </Button>
                <Button
                  variant="outline"
                  onClick={() => router.push(draftingHref(lead.source_id, "clarificari", fallback))}
                >
                  Clarificări & acces dosar
                </Button>
                <Button
                  variant="outline"
                  onClick={() => router.push(analyticsHref(lead.source_id, "caiet", fallback))}
                >
                  Scanează caietul de sarcini
                </Button>
                <Button
                  variant="outline"
                  onClick={() => router.push(analyticsHref(lead.source_id, "win", fallback))}
                >
                  Poziționare preț
                </Button>
                <Button
                  variant="outline"
                  onClick={() => router.push(analyticsHref(lead.source_id, "competitor", fallback))}
                >
                  Profil de piață
                </Button>
                <Button variant="outline" onClick={() => ask()}>
                  <span className="inline-flex items-center gap-1.5">
                    <Sparkles size={15} strokeWidth={1.75} /> Întreabă Copilotul
                  </span>
                </Button>
              </div>
            </div>

            {lead.source_url && (
              <a
                href={lead.source_url}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-6 flex min-h-[44px] w-full items-center justify-center rounded-lg bg-editorial px-4 font-sans text-sm font-medium text-white transition-colors hover:brightness-110"
              >
                Documentul oficial sursă →
              </a>
            )}
          </div>
        </div>
      </div>

      {authorityOpen && (
        <AuthorityProfilePanel cui={lead.authority_cui} name={lead.entity_name} onClose={() => setAuthorityOpen(false)} />
      )}

      {toast && (
        <div
          role="status"
          aria-live="polite"
          className="neu-flat fixed inset-x-4 bottom-24 z-50 rounded-2xl bg-paper px-4 py-3 font-body text-sm text-ink sm:left-auto sm:right-6 sm:max-w-sm"
        >
          {toast}
        </div>
      )}
    </>
  );
}
