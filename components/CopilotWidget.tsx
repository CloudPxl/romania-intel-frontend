"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Check, Loader2, RotateCcw, Sparkles, X } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { useCompanyProfile } from "@/context/CompanyProfileContext";
import { PIPELINE_CHANGED_EVENT, useCopilot } from "@/context/CopilotContext";
import {
  ApiError,
  addLeadToPipeline,
  askCopilotAgent,
  fetchOpportunity,
  triggerEmailAlert,
  updatePipelineDeal,
  type CopilotAction,
  type CopilotTenderCard,
  type CopilotTurn,
  type Lead,
} from "@/lib/api";
import { PRE_SEAP_FOIA_PRESETS, analyticsHref, draftingHref, stashClauses, type AnalyticsTool } from "@/lib/toolLinks";
import { formatRon, stageLabel } from "@/lib/format";
import { cn } from "@/lib/utils";
import AiCredits from "@/components/AiCredits";
import LeadDossierPanel from "@/components/LeadDossierPanel";
import { userKey } from "@/lib/userStorage";

/**
 * The copilot, on every signed-in page, bottom-right.
 *
 * It used to be a tab of its own under Strategie, so asking about the
 * dossier you were reading meant leaving it. Here it knows the screen (the
 * route, the tender a panel or page registered through CopilotContext, the
 * bidder's company) and answers with buttons as well as words: every action
 * the server proposes is performed from here, by the signed-in user, only
 * when they press it — the same API calls the rest of the app makes.
 */

interface Message {
  role: "user" | "assistant";
  text: string;
  actions?: CopilotAction[];
  tenders?: CopilotTenderCard[];
  note?: string | null;
  degraded?: boolean;
}

type ActionState = { status: "busy" | "done" | "error"; message?: string };

const THREAD_BASE = "ro_intel_copilot_thread";
const HIDDEN_ON = ["/login", "/auth"];
const STRATEGY_TOOL: Record<string, AnalyticsTool> = {
  profil_piata: "competitor",
  scanner_caiet: "caiet",
  pozitionare_pret: "win",
};

function readThread(key: string): Message[] {
  try {
    const raw = sessionStorage.getItem(key);
    return raw ? (JSON.parse(raw) as Message[]) : [];
  } catch {
    return [];
  }
}

/** **bold**, list bullets and line breaks — what the model's answers use
 *  that plain text would show as stray asterisks. */
function RichText({ text }: { text: string }) {
  const tidy = text
    .replace(/^([ \t]*)[*-][ \t]+/gm, (_, indent: string) => (indent.length >= 2 ? "    – " : "• "))
    .replace(/^#{1,4}\s+/gm, "");
  return (
    <p className="whitespace-pre-wrap">
      {tidy.split(/(\*\*[^*]+\*\*)/g).map((part, i) =>
        part.startsWith("**") && part.endsWith("**") ? (
          <strong key={i} className="font-semibold">
            {part.slice(2, -2)}
          </strong>
        ) : (
          <span key={i}>{part.replace(/`/g, "")}</span>
        )
      )}
    </p>
  );
}

export default function CopilotWidget() {
  const pathname = usePathname();
  const router = useRouter();
  const { user } = useAuth();
  // One thread per person (lib/userStorage.ts): cleared on sign-out, never
  // shown to the next account in the same tab.
  const threadKey = userKey(THREAD_BASE, user?.user_id);
  const { profile: company, save: saveCompany } = useCompanyProfile();
  const { activeTender, open, setOpen, takePendingPrompt, pendingPrompt } = useCopilot();

  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [deep, setDeep] = useState(false);
  const [creditsKey, setCreditsKey] = useState(0);
  const [actionState, setActionState] = useState<Record<string, ActionState>>({});
  const [dossier, setDossier] = useState<Lead | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // The thread survives a reload of the tab, not a new tab: it is a working
  // conversation, not a history.
  useEffect(() => setMessages(readThread(threadKey)), [threadKey]);
  useEffect(() => {
    try {
      sessionStorage.setItem(threadKey, JSON.stringify(messages.slice(-30)));
    } catch {
      // Storage blocked: the thread lives for this page only.
    }
  }, [messages]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, loading, open]);

  useEffect(() => {
    if (!open) return;
    inputRef.current?.focus();
    // Capture phase, and stopped there: Escape closes the copilot only, not
    // also the dossier drawer underneath it (which listens on window too).
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      e.stopPropagation();
      setOpen(false);
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [open, setOpen]);

  const send = useCallback(
    async (raw: string) => {
      const question = raw.trim();
      if (!question || loading) return;
      setInput("");
      const history: CopilotTurn[] = messages.map((m) => ({ role: m.role, content: m.text }));
      setMessages((prev) => [...prev, { role: "user", text: question }]);
      setLoading(true);
      try {
        const res = await askCopilotAgent(
          question,
          history,
          {
            route: pathname || "/",
            source_id: activeTender?.source_id ?? null,
            company: { cui: company?.cui ?? null, company_name: company?.company_name ?? null },
          },
          deep
        );
        setMessages((prev) => [
          ...prev,
          {
            role: "assistant",
            text: res.reply,
            actions: res.actions,
            tenders: res.tenders,
            note: res.ai_quota || res.notice,
            degraded: res.degraded || Boolean(res.ai_quota),
          },
        ]);
        setCreditsKey((k) => k + 1);
      } catch (e) {
        setMessages((prev) => [
          ...prev,
          { role: "assistant", text: e instanceof ApiError ? e.detail : "Copilotul nu a putut răspunde.", degraded: true },
        ]);
      } finally {
        setLoading(false);
      }
    },
    [loading, messages, pathname, activeTender, company, deep]
  );

  // "Întreabă Copilotul" elsewhere in the app opens this with a question.
  useEffect(() => {
    if (!pendingPrompt || loading) return;
    const prompt = takePendingPrompt();
    if (prompt) send(prompt);
  }, [pendingPrompt, loading, takePendingPrompt, send]);

  const openDossier = async (sourceId: string) => {
    const lead = await fetchOpportunity(sourceId);
    setDossier(lead);
    // The dossier is a full-height drawer on the same side: the chat steps
    // aside instead of covering it, and the button brings it back.
    setOpen(false);
  };

  const perform = async (action: CopilotAction): Promise<string> => {
    const p = action.params;
    switch (action.type) {
      case "open_tender":
        await openDossier(p.source_id!);
        return "Dosar deschis.";
      case "add_to_pipeline": {
        const res = await addLeadToPipeline(await fetchOpportunity(p.source_id!));
        window.dispatchEvent(new Event(PIPELINE_CHANGED_EVENT));
        if (res.status === "already_saved") return "Era deja în pipeline.";
        if (res.status !== "success") throw new Error(res.message || "Nu s-a putut salva dosarul.");
        return res.persisted === false ? "Salvat temporar — baza de date nu răspunde." : "Adăugat în pipeline.";
      }
      case "move_pipeline_stage": {
        const res = await updatePipelineDeal(p.deal_id!, { new_stage: p.stage! });
        if (res.status !== "success") throw new Error(res.message || "Etapa nu a putut fi schimbată.");
        window.dispatchEvent(new Event(PIPELINE_CHANGED_EVENT));
        return `Mutat în ${stageLabel(p.stage)}.`;
      }
      case "set_company_profile":
        await saveCompany({
          cui: p.cui,
          company_name: p.company_name,
          address: p.address ?? undefined,
          registration_number: p.registration_number ?? undefined,
          caen_code: p.caen_code ?? undefined,
        });
        return "Firma a fost salvată ca ofertant (Subscrisa).";
      case "open_drafting": {
        const extra: Record<string, string> = {};
        let tab: "propunere" | "clarificari" = "clarificari";
        if (p.document === "propunere_tehnica") tab = "propunere";
        else if (p.document === "justificare_pret") extra.letter = "abnormally_low_price";
        else if (p.document === "acces_dosar") extra.letter = "dossier_access";
        else if (p.document === "cerere_544") {
          // A pre-SEAP signal: the Legea 544/2001 request for SF/DALI,
          // indicators and the procurement calendar.
          extra.letter = "foia";
          extra.presets = PRE_SEAP_FOIA_PRESETS.join(",");
        }
        else extra.letter = "clarification";
        if (p.points?.length && tab === "clarificari" && extra.letter === "clarification") {
          extra.clauses = stashClauses(p.source_id, {
            project_title: p.project_title,
            points: p.points,
            citations: [],
            origin: "copilot",
          });
        }
        router.push(draftingHref(p.source_id, tab, extra));
        return "Redactarea s-a deschis, pre-completată.";
      }
      case "open_strategy":
        router.push(analyticsHref(p.source_id, STRATEGY_TOOL[p.tool || ""] || "win"));
        return "Instrumentul s-a deschis.";
      case "send_email_alert": {
        const res = await triggerEmailAlert(p.source_id!);
        if (res.status !== "success") throw new Error("Serverul nu are configurat un canal de e-mail.");
        return `Dosarul a fost trimis pe ${res.recipient}.`;
      }
    }
  };

  const runAction = async (action: CopilotAction) => {
    setActionState((s) => ({ ...s, [action.id + action.label]: { status: "busy" } }));
    try {
      const message = await perform(action);
      setActionState((s) => ({ ...s, [action.id + action.label]: { status: "done", message } }));
    } catch (e) {
      const message = e instanceof ApiError ? e.detail : e instanceof Error ? e.message : "Acțiunea a eșuat.";
      setActionState((s) => ({ ...s, [action.id + action.label]: { status: "error", message } }));
    }
  };

  if (!user || HIDDEN_ON.some((prefix) => pathname?.startsWith(prefix))) return null;

  const suggestions = activeTender
    ? [
        "Ce riscuri are acest dosar?",
        "Pregătește o clarificare pentru licitația asta",
        "Adaugă dosarul în pipeline",
        "Unde e pragul de 80% și ce garanții se cer?",
      ]
    : [
        "Ce e nou pentru mine în ultimele 72 de ore?",
        "Caută licitații de reabilitare școli în Cluj peste 1 milion",
        "Ce dosare am în pipeline și ce urmează?",
        company?.cui ? "Ce pot face pentru profilul firmei mele?" : "Setează firma mea după CUI",
      ];

  return (
    <>
      {!open && (
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="Deschide Copilotul"
          title="Copilot RO-INTEL"
          style={{ bottom: "max(1.25rem, env(safe-area-inset-bottom))" }}
          className="fixed right-4 z-[55] flex h-12 items-center gap-2 rounded-full bg-editorial px-4 text-white shadow-float transition-colors duration-[var(--duration-base)] hover:bg-editorial-light active:translate-y-px sm:right-5"
        >
          <Sparkles size={18} strokeWidth={1.9} />
          <span className="hidden text-[15px] font-semibold sm:inline">Copilot</span>
          {activeTender && (
            <span className="absolute -right-1 -top-1 h-3 w-3 rounded-full border-2 border-paper bg-positive" aria-hidden="true" />
          )}
        </button>
      )}

      {open && (
        <section
          role="dialog"
          aria-label="Copilot RO-INTEL"
          className={cn(
            "fixed z-[55] flex flex-col overflow-hidden border border-divider bg-paper shadow-float",
            "inset-x-0 bottom-0 top-[8svh] rounded-t-xl",
            "sm:inset-auto sm:bottom-5 sm:right-5 sm:h-[min(680px,calc(100svh-2.5rem))] sm:w-[420px] sm:rounded-xl",
            "animate-[fade-in_var(--duration-base)_var(--ease-glide)_both]"
          )}
        >
          <header className="flex items-start justify-between gap-3 border-b border-divider px-4 py-3">
            <div className="min-w-0">
              <p className="flex items-center gap-1.5 font-display text-sm font-bold text-ink">
                <Sparkles size={15} className="text-accent" /> Copilot
              </p>
              <p className="font-mono mt-0.5 truncate text-[10px] uppercase tracking-wider text-stock-500">
                {activeTender ? `Dosar activ · ${activeTender.title || activeTender.source_id}` : "Fără dosar activ · întreaga piață"}
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-1">
              {messages.length > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    setMessages([]);
                    setActionState({});
                  }}
                  aria-label="Conversație nouă"
                  title="Conversație nouă"
                  className="flex h-9 w-9 items-center justify-center rounded-xl text-stock-500 hover:neu-pressed-sm hover:text-ink"
                >
                  <RotateCcw size={16} />
                </button>
              )}
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Închide Copilotul"
                className="flex h-9 w-9 items-center justify-center rounded-xl text-stock-500 hover:neu-pressed-sm hover:text-ink"
              >
                <X size={18} />
              </button>
            </div>
          </header>

          <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto px-4 py-4">
            {messages.length === 0 && (
              <div>
                <p className="font-body text-sm leading-relaxed text-stock-600">
                  {activeTender
                    ? "Văd dosarul de pe ecran. Întrebați despre el sau cereți o acțiune — o confirmați dintr-un buton."
                    : "Caut în registru, citesc dosare, gestionez pipeline-ul și pregătesc documente. Acțiunile le confirmați dintr-un buton."}
                </p>
                <div className="mt-3 flex flex-col gap-1.5">
                  {suggestions.map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => send(s)}
                      className="neu-flat-sm rounded-xl bg-paper px-3 py-2 text-left font-body text-[13px] text-ink transition-all hover:text-accent active:neu-pressed-sm"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {messages.map((m, i) => (
              <div key={i} className={cn("flex", m.role === "user" ? "justify-end" : "justify-start")}>
                <div
                  className={cn(
                    "max-w-[92%] rounded-2xl px-3.5 py-2.5 font-body text-[13px] leading-relaxed",
                    m.role === "user"
                      ? "bg-editorial text-white"
                      : m.degraded
                        ? "rounded-lg border border-warning/25 bg-warning-soft text-ink"
                        : "neu-pressed-sm bg-paper text-ink"
                  )}
                >
                  <RichText text={m.text} />

                  {m.tenders && m.tenders.length > 0 && (
                    <ul className="mt-2.5 space-y-1.5">
                      {m.tenders.map((t) => (
                        <li key={t.source_id}>
                          <button
                            type="button"
                            onClick={() => openDossier(t.source_id).catch(() => undefined)}
                            className="neu-flat-sm w-full rounded-xl bg-paper px-3 py-2 text-left transition-all hover:text-accent"
                          >
                            <span className="block truncate text-[13px] font-semibold">{t.project_title || t.source_id}</span>
                            <span className="font-mono block truncate text-[10px] text-stock-500">
                              {[t.entity_name, t.county, t.financial_value_ron ? formatRon(t.financial_value_ron) : null, t.action_deadline && `termen ${t.action_deadline}`]
                                .filter(Boolean)
                                .join(" · ")}
                            </span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}

                  {m.actions && m.actions.length > 0 && (
                    <div className="mt-2.5 flex flex-col gap-1.5">
                      {m.actions.map((a) => {
                        const state = actionState[a.id + a.label];
                        return (
                          <div key={a.id}>
                            <button
                              type="button"
                              disabled={state?.status === "busy" || state?.status === "done"}
                              onClick={() => runAction(a)}
                              className={cn(
                                "flex min-h-[36px] w-full items-center gap-2 rounded-xl px-3 py-1.5 text-left font-sans text-[12px] font-semibold transition-all",
                                state?.status === "done"
                                  ? "neu-pressed-sm bg-paper text-positive"
                                  : "bg-editorial text-white hover:brightness-110 active:scale-[0.98] disabled:opacity-70"
                              )}
                            >
                              {state?.status === "busy" ? (
                                <Loader2 size={14} className="shrink-0 animate-spin" />
                              ) : state?.status === "done" ? (
                                <Check size={14} className="shrink-0" />
                              ) : null}
                              <span className="min-w-0 flex-1">{a.label}</span>
                            </button>
                            {state?.message && (
                              <p className={cn("mt-1 px-1 text-[11px]", state.status === "error" ? "text-negative" : "text-stock-500")}>
                                {state.message}
                              </p>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {m.note && <p className="mt-2 border-t border-divider pt-2 text-[11px] text-warning">{m.note}</p>}
                </div>
              </div>
            ))}

            {loading && (
              <div className="flex items-center gap-2" role="status" aria-live="polite">
                <span className="h-2 w-2 animate-pulse rounded-full bg-editorial" aria-hidden="true" />
                <span className="label-eyebrow text-stock-500">Copilotul lucrează…</span>
              </div>
            )}
          </div>

          <div className="border-t border-divider p-3" style={{ paddingBottom: "max(0.75rem, env(safe-area-inset-bottom))" }}>
            <div className="flex items-end gap-2">
              <textarea
                ref={inputRef}
                rows={1}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    send(input);
                  }
                }}
                placeholder={activeTender ? "Întrebați despre acest dosar…" : "Căutați, întrebați sau cereți o acțiune…"}
                aria-label="Mesaj pentru Copilot"
                className="neu-pressed-sm max-h-32 min-h-[44px] flex-1 resize-none rounded-2xl bg-paper px-3.5 py-2.5 font-body text-[16px] text-ink outline-none placeholder:text-stock-400 sm:text-sm"
              />
              <button
                type="button"
                onClick={() => send(input)}
                disabled={loading || !input.trim()}
                className="flex h-11 shrink-0 items-center rounded-2xl bg-editorial px-4 font-sans text-sm font-semibold text-white transition-all hover:brightness-110 disabled:opacity-50"
              >
                Trimite
              </button>
            </div>
            <div className="mt-2 flex items-center justify-between gap-2">
              <label className="flex cursor-pointer items-center gap-1.5 font-sans text-[11px] text-stock-500">
                <input
                  type="checkbox"
                  checked={deep}
                  onChange={(e) => setDeep(e.target.checked)}
                  className="h-3.5 w-3.5 accent-[var(--color-editorial)]"
                />
                Analiză aprofundată
              </label>
              <AiCredits refreshKey={creditsKey} compact />
            </div>
          </div>
        </section>
      )}

      {dossier && <LeadDossierPanel lead={dossier} onClose={() => setDossier(null)} />}
    </>
  );
}
