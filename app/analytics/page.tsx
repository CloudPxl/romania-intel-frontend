"use client";
import { Suspense, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import AuthGate from "@/components/AuthGate";
import AiCredits from "@/components/AiCredits";
import AuthorityProfilePanel from "@/components/AuthorityProfilePanel";
import Explain from "@/components/Explain";
import LeadDossierPanel from "@/components/LeadDossierPanel";
import {
  ApiError,
  analyzeCaietSarcini,
  askCopilotChat,
  contractTypeFromCpv,
  fetch72hMarketReport,
  fetchArtifact,
  fetchCompetitorAnalysis,
  fetchDocumentExtraction,
  fetchOpportunity,
  generateJustificationDossier,
  predictWinRate,
  uploadCaietFile,
  uploadCaietFileAsync,
  type AwardCriterion,
  type CaietAnalysis,
  type CaietFlag,
  type CompetitorAnalysis,
  type ContractType,
  type CopilotTurn,
  type JustificationDossier,
  type Lead,
  type LegalRegime,
  type MacroReport,
  type WinOdds,
} from "@/lib/api";
import { draftingHref, stashClauses } from "@/lib/toolLinks";
import { CATEGORIES, formatDate, formatNumber, formatRon } from "@/lib/format";
import {
  Badge,
  Button,
  Checkbox,
  Eyebrow,
  Field,
  Input,
  Loading,
  Notice,
  NumberInput,
  PageHeader,
  Panel,
  SectionTitle,
  Select,
  TabBar,
  Textarea,
} from "@/components/newsprint";

const TOOLS = [
  { id: "copilot", label: "Copilot & Radar 72h" },
  { id: "competitor", label: "Profil de piață" },
  { id: "caiet", label: "Scanner caiet sarcini" },
  { id: "win", label: "Poziționare preț" },
] as const;

type ToolId = (typeof TOOLS)[number]["id"];

/* ---------------------------------------------------------------- copilot */

function CopilotTool() {
  const [report, setReport] = useState<MacroReport | null>(null);
  const [messages, setMessages] = useState<
    { sender: "user" | "ai"; text: string; degraded?: boolean; deep?: boolean; note?: string | null }[]
  >([
    {
      sender: "ai",
      text: "Bună ziua. Pot analiza oportunitățile din registru, cerințele de calificare și strategia de ofertare. Cu ce începem?",
    },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  // Flagship model (gemini-4-argon) for this turn. Included in subscriptions;
  // a free account asking for it is answered on the standard model and told so.
  const [deep, setDeep] = useState(false);
  const [creditsKey, setCreditsKey] = useState(0);
  const [reportError, setReportError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let mounted = true;
    fetch72hMarketReport()
      .then((d) => mounted && setReport(d))
      .catch((e) => mounted && setReportError(e instanceof ApiError ? e.detail : "Raportul macro nu este disponibil."));
    return () => {
      mounted = false;
    };
  }, []);

  // Keep the newest turn in view without yanking the whole page.
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, loading]);

  const handleSend = async () => {
    const question = input.trim();
    if (!question || loading) return;
    setInput("");
    // Snapshot the transcript *before* appending this turn — the backend
    // takes the question separately, and sending it twice would have the
    // model answer a message it can already see as the newest turn.
    // The opening canned greeting is dropped: it is UI copy, not
    // something the model said.
    const history: CopilotTurn[] = messages
      .slice(1)
      .map((m) => ({ role: m.sender === "user" ? ("user" as const) : ("assistant" as const), content: m.text }));
    setMessages((prev) => [...prev, { sender: "user", text: question }]);
    setLoading(true);
    try {
      const data = await askCopilotChat(question, history, deep);
      setMessages((prev) => [
        ...prev,
        {
          sender: "ai",
          text: data.reply,
          degraded: data.degraded || Boolean(data.ai_quota),
          deep: data.deep,
          note: data.ai_quota || data.notice,
        },
      ]);
      setCreditsKey((k) => k + 1);
    } catch (e) {
      setMessages((prev) => [
        ...prev,
        { sender: "ai", text: e instanceof ApiError ? e.detail : "Copilotul nu a putut răspunde.", degraded: true },
      ]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
      {/* Deliberately quiet: the copilot is the page, and this rail is a
          short read-only digest beside it — not a dashboard competing with
          it for attention. The market figures it used to headline live on
          /analysis, which is the page for them. */}
      <aside className="lg:col-span-4">
        {reportError ? (
          <Notice tone="alert">{reportError}</Notice>
        ) : !report ? (
          <Panel className="p-4">
            <p className="font-mono text-xs uppercase tracking-widest text-stock-500">Se încarcă…</p>
          </Panel>
        ) : (
          <Panel className="p-4 sm:p-5">
            <Eyebrow className="text-stock-500">Puncte cheie</Eyebrow>
            {report.executive_takeaways?.length ? (
              <ol className="mt-2 divide-y divide-divider">
                {report.executive_takeaways.map((t, i) => (
                  <li key={i} className="flex gap-3 py-2.5 first:pt-0">
                    <span className="tabular font-mono w-5 shrink-0 pt-0.5 text-xs text-stock-400">
                      {String(i + 1).padStart(2, "0")}
                    </span>
                    <p className="font-body flex-1 text-sm leading-relaxed">{t}</p>
                  </li>
                ))}
              </ol>
            ) : (
              <p className="font-body mt-2 text-sm leading-relaxed text-stock-600">
                Nu există suficiente semnale noi în ultimele 72 de ore pentru o sinteză.
              </p>
            )}

            {report.strategic_recommendation && (
              <div className="neu-pressed mt-4 rounded-r-lg border-l-2 border-editorial bg-editorial-soft px-4 py-3">
                <Eyebrow className="text-editorial">Recomandare strategică</Eyebrow>
                <p className="font-body mt-1.5 text-sm leading-relaxed">{report.strategic_recommendation}</p>
              </div>
            )}
          </Panel>
        )}
      </aside>

      <div className="lg:col-span-8">
        <Panel className="flex h-[60vh] min-h-[26rem] flex-col">
          <div ref={scrollRef} className="flex-1 space-y-4 overflow-y-auto p-4">
            {messages.map((m, i) => (
              <div key={i} className={"flex " + (m.sender === "user" ? "justify-end" : "justify-start")}>
                <div
                  className={
                    "max-w-[88%] rounded-2xl px-3.5 py-2.5 font-body text-sm leading-relaxed " +
                    (m.sender === "user"
                      ? "neu-flat-sm bg-editorial text-white"
                      : m.degraded
                        ? "neu-pressed border-l-[3px] border-warning bg-paper"
                        : "neu-flat-sm bg-paper")
                  }
                >
                  {m.sender === "ai" && (
                    <span className="label-eyebrow mb-1 block text-stock-500">
                      {m.degraded ? "Răspuns degradat" : m.deep ? "Copilot · analiză aprofundată" : "Copilot"}
                    </span>
                  )}
                  <p className="whitespace-pre-wrap">{m.text}</p>
                  {m.note && <p className="font-body mt-2 border-t border-divider pt-2 text-xs text-warning">{m.note}</p>}
                </div>
              </div>
            ))}
            {loading && (
              <div className="flex items-center gap-2" role="status" aria-live="polite">
                <span className="h-2 w-2 animate-pulse rounded-full bg-editorial" aria-hidden="true" />
                <span className="label-eyebrow text-stock-500">Copilotul analizează registrul…</span>
              </div>
            )}
          </div>

          <div className="flex gap-2 border-t border-divider p-3">
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleSend();
                }
              }}
              placeholder="Întrebați despre cerințe, bugete, contestații…"
              aria-label="Întrebare pentru copilot"
              className="flex-1"
            />
            <Button onClick={handleSend} disabled={loading || !input.trim()}>
              Trimite
            </Button>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-divider px-3 py-2">
            <Checkbox
              label="Analiză aprofundată (model flagship)"
              checked={deep}
              onChange={(e) => setDeep(e.target.checked)}
              className="min-h-8 text-xs"
            />
            <AiCredits refreshKey={creditsKey} />
          </div>
        </Panel>
      </div>
    </div>
  );
}

/* ----------------------------------------------------------------- tender */

/** The tender a tool was opened for — from a dossier, the pipeline or a
 *  link carrying `source_id`. Every field the tools would otherwise ask the
 *  user to re-type comes from here. */
interface Tender {
  source_id: string | null;
  project_title: string;
  entity_name: string;
  authority_cui: string | null;
  county: string;
  category: string;
  cpv_code: string | null;
  budget: number;
  contract_type: ContractType | null;
}

function tenderFrom(lead: Lead | null, params: URLSearchParams): Tender {
  const budget = lead?.financial_value_ron || Number(params.get("budget") || 0) || 0;
  const cpv = lead?.cpv_code || params.get("cpv") || null;
  return {
    source_id: lead?.source_id || params.get("source_id"),
    project_title: lead?.project_title || params.get("project_title") || "",
    entity_name: lead?.entity_name || params.get("authority_name") || "",
    authority_cui: lead?.authority_cui ?? null,
    county: lead?.county && lead.county !== "Necunoscut" ? lead.county : params.get("county") || "",
    category: lead?.category || params.get("category") || "",
    cpv_code: cpv,
    budget,
    contract_type: contractTypeFromCpv(cpv),
  };
}

function TenderBanner({ tender }: { tender: Tender }) {
  if (!tender.source_id) return null;
  return (
    <div className="neu-pressed mb-6 rounded-2xl bg-paper px-4 py-3">
      <Eyebrow className="text-editorial">Licitația analizată · {tender.source_id}</Eyebrow>
      <p className="font-body mt-1 text-sm font-semibold leading-snug">{tender.project_title}</p>
      <p className="font-mono mt-0.5 text-[11px] text-stock-500">
        {[tender.entity_name, tender.county, tender.cpv_code && `CPV ${tender.cpv_code}`, tender.budget && formatRon(tender.budget)]
          .filter(Boolean)
          .join(" · ")}
      </p>
    </div>
  );
}

/* ------------------------------------------------------------- competitor */
function CompetitorTool({ tender }: { tender: Tender }) {
  const [category, setCategory] = useState(tender.category || "infrastructura");
  const [county, setCounty] = useState(tender.county || "");
  const [budget, setBudget] = useState(tender.budget || 10_000_000);
  const [data, setData] = useState<CompetitorAnalysis | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Every row and every authority is a way in, opened in place.
  const [openLead, setOpenLead] = useState<Lead | null>(null);
  const [authority, setAuthority] = useState<{ cui: string | null; name: string } | null>(null);

  const handleAnalyze = async () => {
    if (!county.trim()) {
      setError("Introduceți județul pentru care doriți analiza.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      setData(
        await fetchCompetitorAnalysis(category, county, budget, {
          cpvCode: tender.cpv_code,
          contractType: tender.contract_type && tender.contract_type !== "servicii_sociale" ? tender.contract_type : null,
        })
      );
    } catch (e) {
      setError(e instanceof ApiError ? e.detail : "Analiza pieței a eșuat.");
    } finally {
      setLoading(false);
    }
  };

  // Opened from a dossier with everything known: run it, don't make the
  // user press a button to see the answer to the question they came with.
  useEffect(() => {
    if (tender.source_id && tender.county) handleAnalyze();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const openProcedure = async (sourceId: string) => {
    try {
      setOpenLead(await fetchOpportunity(sourceId));
    } catch (e) {
      setError(e instanceof ApiError ? e.detail : "Dosarul nu a putut fi deschis.");
    }
  };

  const market = data?.observed_market;
  const pricing = data?.pricing;
  const awards = data?.award_intelligence;
  const pct = pricing?.percentiles;
  const statutory = pricing?.statutory_threshold;
  const authorities =
    market?.authorities ?? market?.contracting_authorities_observed?.map((name) => ({ name, cui: null, procedures: 0 })) ?? [];

  return (
    <Panel className="p-4 sm:p-6">
      <h2 className="font-display text-2xl font-bold leading-tight tracking-tight">Profil de piață sectorial</h2>
      <p className="font-body mt-1.5 text-sm leading-relaxed text-stock-600">
        Anunțurile colectate de acest sistem pentru domeniul și județul selectate, plus prețurile câștigătoare reale din
        anunțurile de atribuire SEAP.
      </p>

      <div className="mt-6 grid grid-cols-1 gap-5 sm:grid-cols-3">
        <Field label="Domeniu">
          <Select value={category} onChange={(e) => setCategory(e.target.value)}>
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
        <Field label="Valoare estimată (RON, fără TVA)">
          <NumberInput min={0} value={budget} onValueChange={setBudget} />
        </Field>
      </div>

      {error && (
        <div className="mt-5">
          <Notice tone="alert">{error}</Notice>
        </div>
      )}

      <Button onClick={handleAnalyze} disabled={loading} fullWidth className="mt-6">
        {loading ? "Se analizează piața…" : "Analizează piața"}
      </Button>

      {loading && (
        <div className="mt-6">
          <Loading label="Se agregă procedurile comparabile" />
        </div>
      )}

      {data && !loading && (
        <div className="mt-8 space-y-8">
          <section>
            <SectionTitle note={`${data.sector} · ${data.county}`}>Piața observată</SectionTitle>
            {market?.scope_note && (
              <div className="mb-4">
                <Notice tone={market.scope === "county" ? "neutral" : "warning"}>{market.scope_note}</Notice>
              </div>
            )}
            {/* Both counts come from the same set — procedures in this domain
                with a published value — so the county figure is always a
                subset of the national one it sits beside. */}
            <div className="rule-grid grid grid-cols-2 sm:grid-cols-4">
              <div className="p-4">
                <Eyebrow>Proceduri comparabile</Eyebrow>
                <p className="tabular font-display mt-1.5 text-2xl font-semibold leading-none">
                  {formatNumber(market?.comparable_procedures_ingested)}
                </p>
                <p className="font-mono mt-1 text-[10px] text-stock-500">în toată țara, cu valoare publicată</p>
              </div>
              <div className="p-4">
                <Eyebrow>Din care în {data.county || "județ"}</Eyebrow>
                <p className="tabular font-display mt-1.5 text-2xl font-semibold leading-none">
                  {formatNumber(market?.in_requested_county)}
                </p>
                <p className="font-mono mt-1 text-[10px] text-stock-500">același eșantion, filtrat pe județ</p>
              </div>
              <div className="p-4">
                <span className="inline-flex items-center gap-1.5">
                  <Eyebrow>Valoare mediană</Eyebrow>
                  <Explain k="medianValue" />
                </span>
                <p className="tabular font-display mt-1.5 text-2xl font-semibold leading-none">
                  {formatRon(market?.value_distribution_ron?.median)}
                </p>
              </div>
              <div className="p-4">
                <Eyebrow>Interval valoric</Eyebrow>
                <p className="font-mono mt-1.5 text-xs leading-relaxed">
                  {formatRon(market?.value_distribution_ron?.min)}
                  <br />— {formatRon(market?.value_distribution_ron?.max)}
                </p>
              </div>
            </div>
          </section>

          {pricing && (
            <section>
              <span className="flex items-center gap-1.5">
                <SectionTitle note={pct ? `${pct.sample_size} atribuiri · ${pct.scope_label}` : "fără eșantion"}>
                  Repere de preț
                </SectionTitle>
                <Explain k="priceReferences" className="mb-4" />
              </span>

              {pct ? (
                <>
                  <p className="font-body mb-3 text-sm leading-relaxed text-stock-600">
                    Prețuri câștigătoare reale, exprimate ca procent din valoarea estimată și aplicate valorii dvs. de{" "}
                    {formatRon(budget)}:
                  </p>
                  <div className="rule-grid grid grid-cols-2 sm:grid-cols-5">
                    {(["p5", "p25", "p50", "p75", "p95"] as const).map((k) => (
                      <div key={k} className="p-4">
                        <Eyebrow>{k === "p50" ? "Median" : k.toUpperCase()}</Eyebrow>
                        <p className="tabular font-display mt-1.5 text-lg font-semibold leading-none">
                          {formatRon(pct.prices_ron[k])}
                        </p>
                        <p className="font-mono mt-1 text-[10px] text-stock-500">{pct.ratio_pct[k].toFixed(1)}% din estimare</p>
                      </div>
                    ))}
                  </div>
                  <p className="font-mono mt-3 text-[11px] leading-relaxed text-stock-500">
                    Interval intercuartilic {pct.ratio_pct.iqr.toFixed(1)} puncte procentuale ·{" "}
                    {pct.below_80pct_share != null && `${pct.below_80pct_share}% dintre câștigători au fost sub 80% · `}
                    {pct.single_offer?.rate_pct != null &&
                      `ofertă unică probabilă în ${pct.single_offer.rate_pct}% din ${pct.single_offer.sample_size} contracte`}
                  </p>
                </>
              ) : (
                <Notice tone="neutral" title="Încă nu avem un eșantion de atribuiri">
                  {pricing.reference_points_note}
                </Notice>
              )}

              {statutory && (
                <div className="neu-pressed mt-4 rounded-r-lg border-l-2 border-warning bg-paper px-4 py-3">
                  <Eyebrow className="text-warning">Pragul legal de 80%</Eyebrow>
                  <p className="font-body mt-1 text-sm leading-relaxed">
                    Sub <span className="tabular font-semibold">{formatRon(statutory.price_ron)}</span> (fără TVA) oferta este
                    prezumată ca având un preț aparent neobișnuit de scăzut — {statutory.basis}.
                  </p>
                </div>
              )}
              <p className="neu-pressed font-body mt-4 rounded-2xl bg-paper px-4 py-3 text-sm leading-relaxed text-stock-600">
                {pricing.guidance}
              </p>
              {pricing.sector_technical_note && (
                <p className="neu-pressed font-body mt-3 rounded-2xl bg-paper px-4 py-3 text-sm leading-relaxed text-stock-600">
                  {pricing.sector_technical_note}
                </p>
              )}
            </section>
          )}

          {awards?.recurring_winners?.length ? (
            <section>
              <span className="flex items-center gap-1.5">
                <SectionTitle note="achiziții directe">Câștigători observați</SectionTitle>
                <Explain k="recurringWinners" className="mb-4" />
              </span>
              <ul className="divide-y divide-divider">
                {awards.recurring_winners.map((w) => (
                  <li key={w.name} className="flex items-baseline justify-between gap-3 py-2">
                    <span className="font-body text-sm">{w.name}</span>
                    <span className="tabular font-mono shrink-0 text-xs text-stock-500">
                      {w.awards} atribuiri · {w.share_pct}%
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          {market?.procedures?.length ? (
            <section>
              <SectionTitle note={`${market.procedures.length} dosare`}>Procedurile din spatele cifrelor</SectionTitle>
              <ul className="divide-y divide-divider">
                {market.procedures.map((p, i) => (
                  <li key={p.source_id || i}>
                    <button
                      disabled={!p.source_id}
                      onClick={() => p.source_id && openProcedure(p.source_id)}
                      className="flex w-full items-baseline justify-between gap-3 py-2.5 text-left transition-colors duration-[var(--duration-base)] hover:text-editorial disabled:cursor-default"
                    >
                      <span className="min-w-0 flex-1">
                        <span className="font-body block truncate text-sm font-medium">{p.project_title || "Fără titlu"}</span>
                        <span className="font-mono block truncate text-[11px] text-stock-500">
                          {p.entity_name}
                          {p.county ? ` · ${p.county}` : ""}
                        </span>
                      </span>
                      <span className="tabular font-mono shrink-0 text-xs text-stock-600">
                        {formatRon(p.financial_value_ron ?? 0)}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          {authorities.length ? (
            <section>
              <SectionTitle note={`${authorities.length} entități`}>Autorități contractante observate</SectionTitle>
              <ul className="divide-y divide-divider">
                {authorities.map((a) => (
                  <li key={a.name}>
                    <button
                      onClick={() => setAuthority({ cui: a.cui, name: a.name })}
                      className="flex w-full items-baseline justify-between gap-3 py-2.5 text-left transition-colors hover:text-editorial"
                      title="Atribuiri reale, concentrarea furnizorilor, câștigători"
                    >
                      <span className="font-body text-sm">{a.name}</span>
                      <span className="font-mono shrink-0 text-[11px] text-stock-500">
                        {a.procedures ? `${a.procedures} proc. · ` : ""}profil →
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          <Notice tone="warning" title="Limitele analizei">
            {data.data_limitations}
          </Notice>
        </div>
      )}

      {openLead && <LeadDossierPanel lead={openLead} onClose={() => setOpenLead(null)} />}
      {authority && <AuthorityProfilePanel cui={authority.cui} name={authority.name} onClose={() => setAuthority(null)} />}
    </Panel>
  );
}

/* ------------------------------------------------------------------ caiet */

const SEVERITY_TONE: Record<string, "negative" | "warning" | "neutral"> = { Critic: "negative", Ridicat: "warning" };

function CaietTool({ tender, artifactId }: { tender: Tender; artifactId: string | null }) {
  const router = useRouter();
  const [projectTitle, setProjectTitle] = useState(tender.project_title || "");
  const [text, setText] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [result, setResult] = useState<CaietAnalysis | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ocrStatus, setOcrStatus] = useState<"idle" | "queued" | "processing" | "done" | "failed">("idle");
  const [ocrApplied, setOcrApplied] = useState<boolean | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [fromArtifact, setFromArtifact] = useState<string | null>(null);
  const cancelledRef = useRef(false);

  const context = {
    sourceId: tender.source_id,
    estimatedValueRon: tender.budget || null,
    contractType: tender.contract_type,
    authorityName: tender.entity_name || null,
  };

  useEffect(() => {
    cancelledRef.current = false;
    return () => {
      cancelledRef.current = true;
    };
  }, []);

  // A scan reopened from its pipeline badge: the findings as they were,
  // without keeping the caiet itself.
  useEffect(() => {
    if (!artifactId) return;
    fetchArtifact(artifactId)
      .then((a) => {
        const payload = a.payload as { project_title?: string; bias_score?: number; bias_risk_level?: string; flags?: CaietFlag[] };
        setProjectTitle(payload.project_title || projectTitle);
        setResult({
          project_title: payload.project_title,
          bias_score: payload.bias_score,
          bias_risk_level: payload.bias_risk_level,
          detected_red_flags: payload.flags || [],
        });
        setFromArtifact(a.created_at);
      })
      .catch(() => setError("Scanarea salvată nu a putut fi încărcată."));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [artifactId]);

  const realFlags = (result?.detected_red_flags ?? []).filter((f) => f.severity !== "OK");
  const flagKey = (f: CaietFlag, i: number) => f.flag_id || `${f.pattern}-${i}`;

  // Everything flagged starts selected: the common case is "contest all of
  // it", and unticking is one click per clause.
  useEffect(() => {
    setSelected(new Set(realFlags.map(flagKey)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [result]);

  const runAsyncOcrFlow = async (f: File, title: string) => {
    setOcrStatus("queued");
    setOcrApplied(null);
    try {
      const { doc_id } = await uploadCaietFileAsync(f);
      setOcrStatus("processing");
      for (let attempt = 0; attempt < 40; attempt++) {
        if (cancelledRef.current) return;
        const row = await fetchDocumentExtraction(doc_id);
        if (row.status === "done") {
          setOcrApplied(row.ocr_applied);
          setResult(await analyzeCaietSarcini(title, undefined, doc_id, context));
          setOcrStatus("done");
          return;
        }
        if (row.status === "failed") {
          setError(
            (row.error_message || "Procesarea OCR a eșuat.") +
              " Documentul pare scanat fără strat de text: copiați cerințele din PDF și lipiți-le în câmpul de text."
          );
          setOcrStatus("failed");
          return;
        }
        await new Promise((r) => setTimeout(r, 3000));
      }
      if (!cancelledRef.current) {
        setError("Procesarea OCR durează mai mult decât de obicei — reveniți mai târziu sau lipiți textul cerințelor.");
        setOcrStatus("failed");
      }
    } catch (e) {
      if (!cancelledRef.current) {
        setError(e instanceof ApiError ? e.detail : "Procesarea OCR a eșuat.");
        setOcrStatus("failed");
      }
    }
  };

  const handleAnalyze = async (useExtracted = false) => {
    if (!projectTitle.trim()) {
      setError("Introduceți titlul proiectului analizat.");
      return;
    }
    if (!useExtracted && !file && !text.trim()) {
      setError("Încărcați un fișier sau lipiți textul caietului de sarcini.");
      return;
    }
    setLoading(true);
    setError(null);
    setOcrStatus("idle");
    setOcrApplied(null);
    setFromArtifact(null);
    try {
      if (useExtracted) {
        setResult(await analyzeCaietSarcini(projectTitle, undefined, undefined, context));
      } else {
        setResult(
          file
            ? await uploadCaietFile(file, projectTitle, tender.source_id)
            : await analyzeCaietSarcini(projectTitle, text, undefined, context)
        );
      }
    } catch (e) {
      if (file && e instanceof ApiError && e.status === 422 && e.detail.includes("upload-caiet-async")) {
        await runAsyncOcrFlow(file, projectTitle);
      } else if (useExtracted && e instanceof ApiError && e.status === 404) {
        setError("Nu avem încă documentația extrasă pentru acest anunț. Încărcați caietul sau lipiți textul cerințelor.");
      } else {
        setError(e instanceof ApiError ? e.detail : "Analiza documentului a eșuat.");
      }
    } finally {
      setLoading(false);
    }
  };

  const forwardToDrafting = () => {
    const chosen = realFlags.filter((f, i) => selected.has(flagKey(f, i)));
    if (!chosen.length) return;
    const key = stashClauses(tender.source_id, {
      project_title: projectTitle,
      points: chosen.map((f) => f.clarification_paragraph || `${f.pattern}: ${f.tactical_advisory}`),
      citations: Array.from(new Set(chosen.flatMap((f) => f.legal_citations || []))),
    });
    router.push(
      draftingHref(tender.source_id, "clarificari", {
        letter: "clarification",
        clauses: key,
        ...(tender.source_id ? {} : { project_title: projectTitle }),
      })
    );
  };

  return (
    <Panel className="p-4 sm:p-6">
      <h2 className="font-display text-2xl font-bold leading-tight tracking-tight">Scanner clauze restrictive</h2>
      <p className="font-body mt-1.5 text-sm leading-relaxed text-stock-600">
        Tipare de clauze restrictive plus verificări calculate pe textul legii (cifra de afaceri, garanțiile, criteriul de
        atribuire, experiența personalului). Clauzele bifate pleacă direct în solicitarea de clarificări.
      </p>

      <div className="mt-6 space-y-5">
        <Field label="Titlu proiect">
          <Input value={projectTitle} onChange={(e) => setProjectTitle(e.target.value)} />
        </Field>

        {tender.source_id && (
          <Button variant="outline" fullWidth onClick={() => handleAnalyze(true)} disabled={loading}>
            Scanează documentația deja extrasă pentru {tender.source_id}
          </Button>
        )}

        <div>
          <Eyebrow className="mb-1.5 text-stock-600">Document caiet de sarcini</Eyebrow>
          <label
            htmlFor="caiet-upload"
            className="flex min-h-[6rem] cursor-pointer flex-col items-center justify-center neu-pressed rounded-3xl bg-paper p-5 text-center transition-all duration-300 hover:neu-pressed-deep"
          >
            <input
              id="caiet-upload"
              type="file"
              accept=".pdf,.docx,.txt"
              onChange={(e) => setFile(e.target.files?.[0] || null)}
              className="sr-only"
            />
            <span className="font-body text-sm font-semibold">{file ? file.name : "Alegeți un fișier PDF, DOCX sau TXT"}</span>
            <span className="font-mono mt-1 text-[11px] uppercase tracking-wider text-stock-500">
              {file ? `${(file.size / 1024).toFixed(0)} KB · apăsați pentru a schimba` : "PDF scanat? îl trecem prin OCR automat"}
            </span>
          </label>
          {file && (
            <button onClick={() => setFile(null)} className="mt-2 text-sm font-medium text-editorial hover:brightness-110">
              Elimină fișierul
            </button>
          )}
        </div>

        <Field label="Text caiet de sarcini" hint="Ignorat dacă a fost încărcat un fișier. Varianta sigură pentru un PDF scanat greu lizibil.">
          <Textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            disabled={Boolean(file)}
            placeholder="Lipiți cerințele tehnice și de calificare…"
          />
        </Field>
      </div>

      {error && (
        <div className="mt-5">
          <Notice tone="alert">{error}</Notice>
        </div>
      )}

      <Button onClick={() => handleAnalyze(false)} disabled={loading} fullWidth className="mt-6">
        {loading ? "Se analizează documentul…" : "Scanează clauzele"}
      </Button>

      {loading && (
        <div className="mt-6">
          <Loading label="Se verifică tiparele și plafoanele legale" />
        </div>
      )}

      {!loading && (ocrStatus === "queued" || ocrStatus === "processing") && (
        <div className="mt-6">
          <Loading
            label={
              ocrStatus === "queued"
                ? "Documentul scanat a fost pus în coadă pentru OCR…"
                : "Se procesează OCR — poate dura până la câteva minute pentru documente lungi…"
            }
          />
        </div>
      )}

      {result && !loading && (
        <div className="mt-8 space-y-6">
          {fromArtifact && <Badge tone="neutral">Scanare salvată din {formatDate(fromArtifact)}</Badge>}
          {ocrApplied && <Badge tone="neutral">Document procesat prin OCR (scanare, fără strat de text digital)</Badge>}
          <div className="neu-flat rounded-3xl bg-paper p-5">
            <div className="flex flex-wrap items-baseline justify-between gap-3">
              <div>
                <Eyebrow className="text-editorial">Nivel de risc restrictiv</Eyebrow>
                <p className="font-display mt-1 text-3xl font-semibold leading-tight">{result.bias_risk_level || "—"}</p>
              </div>
              {result.bias_score != null && (
                <p className="tabular font-display text-4xl font-semibold">
                  {result.bias_score}
                  <span className="font-mono text-sm font-normal tracking-widest text-stock-500"> / 10</span>
                </p>
              )}
            </div>
            {result.recommended_action && (
              <p className="font-body mt-4 border-t border-divider pt-4 text-sm leading-relaxed text-stock-700">
                {result.recommended_action}
              </p>
            )}
          </div>

          {realFlags.length > 0 ? (
            <section>
              <SectionTitle note={`${selected.size} din ${realFlags.length} selectate`}>Clauze semnalate</SectionTitle>
              <div className="divide-y divide-divider neu-flat overflow-hidden rounded-3xl bg-paper">
                {realFlags.map((flag, i) => {
                  const key = flagKey(flag, i);
                  const checked = selected.has(key);
                  return (
                    <div key={key} className="flex gap-3 p-4">
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => {
                          const next = new Set(selected);
                          if (checked) next.delete(key);
                          else next.add(key);
                          setSelected(next);
                        }}
                        aria-label={`Include „${flag.pattern}” în solicitarea de clarificări`}
                        className="mt-1.5 h-4 w-4 shrink-0 accent-[var(--color-editorial)]"
                      />
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-baseline justify-between gap-2">
                          <h3 className="font-display text-lg font-semibold capitalize leading-snug">{flag.pattern}</h3>
                          <Badge tone={SEVERITY_TONE[flag.severity] ?? "neutral"}>Risc {flag.severity}</Badge>
                        </div>
                        {flag.excerpt && (
                          <p className="font-body mt-1.5 border-l-2 border-divider pl-3 text-sm italic text-stock-600">„{flag.excerpt}”</p>
                        )}
                        <p className="font-body mt-2 text-sm leading-relaxed text-stock-700">{flag.tactical_advisory}</p>
                        {flag.legal_citations?.length ? (
                          <p className="font-mono mt-1.5 text-[11px] text-stock-500">Temei: {flag.legal_citations.join("; ")}</p>
                        ) : null}
                      </div>
                    </div>
                  );
                })}
              </div>
              <Button onClick={forwardToDrafting} disabled={!selected.size} fullWidth className="mt-4">
                Generează solicitare de clarificări / remediere (art. 160) cu {selected.size}{" "}
                {selected.size === 1 ? "clauză" : "clauze"}
              </Button>
            </section>
          ) : (
            <Notice title="Fără semnalări">Nu au fost detectate clauze restrictive dintre tiparele verificate.</Notice>
          )}

          {result.qualification_criteria && (
            <section>
              <SectionTitle>Cerințe de calificare extrase</SectionTitle>
              <div className="divide-y divide-divider neu-flat overflow-hidden rounded-3xl bg-paper">
                {(
                  [
                    ["Cerințe cifră de afaceri", result.qualification_criteria.turnover_requirements],
                    ["Certificări solicitate", result.qualification_criteria.required_certifications],
                    ["Personal-cheie", result.qualification_criteria.key_personnel_roles],
                    ["Echipamente obligatorii", result.qualification_criteria.mandatory_equipment],
                  ] as [string, string[] | undefined][]
                ).map(([label, values]) => (
                  <div key={label} className="p-4">
                    <Eyebrow>{label}</Eyebrow>
                    <ul className="mt-1.5">
                      {(values?.length ? values : ["—"]).map((v, i) => (
                        <li key={i} className="font-body text-sm leading-relaxed">
                          {v}
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
              {result.qualification_criteria.extraction_note && (
                <p className="font-mono mt-3 text-[11px] leading-relaxed text-stock-500">
                  {result.qualification_criteria.extraction_note}
                </p>
              )}
            </section>
          )}

          {result.net_zero && (
            <section>
              <SectionTitle>Tehnologii „zero net” — art. 25 NZIA</SectionTitle>
              <div className="neu-flat rounded-3xl bg-paper p-4">
                <p className="font-body text-sm leading-relaxed">
                  Obiectul include: <strong>{result.net_zero.technologies.join(", ")}</strong>.{" "}
                  {result.net_zero.above_eu_threshold === false
                    ? "Valoarea este sub pragul UE: art. 25 din Regulamentul (UE) 2024/1735 nu se aplică."
                    : result.net_zero.documentation_mentions.length
                      ? `Documentația face referire la regulament (${result.net_zero.documentation_mentions.join(", ")}): pregătiți dovezile de mai jos.`
                      : result.net_zero.above_eu_threshold
                        ? "Valoarea depășește pragul UE, iar documentația nu menționează regulamentul — vezi semnalarea de mai sus."
                        : "Valoarea nu este cunoscută: dacă depășește pragul UE, se aplică obligațiile de mai jos."}
                </p>
                {result.net_zero.applies && (
                  <ul className="mt-3 space-y-1.5">
                    {result.net_zero.bidder_obligations.map((o, i) => (
                      <li key={i} className="font-body text-sm leading-relaxed text-stock-700">
                        — {o}
                      </li>
                    ))}
                  </ul>
                )}
                <p className="font-mono mt-3 text-[11px] leading-relaxed text-stock-500">{result.net_zero.guidance.join(" · ")}</p>
              </div>
            </section>
          )}

          {result.coverage_note && (
            <Notice tone="warning" title="Acoperirea analizei">
              {result.coverage_note}
            </Notice>
          )}
        </div>
      )}
    </Panel>
  );
}

/* -------------------------------------------------------------- win odds */

const CRITERIA: { id: AwardCriterion; label: string }[] = [
  { id: "lowest_price", label: "Prețul cel mai scăzut" },
  { id: "best_value", label: "Cel mai bun raport calitate-preț" },
  { id: "best_cost", label: "Cel mai bun raport calitate-cost" },
  { id: "lowest_cost", label: "Costul cel mai scăzut" },
];

const RISK_BORDER: Record<string, string> = {
  no_presumption: "border-positive",
  near_threshold: "border-warning",
  presumption: "border-negative",
  over_budget: "border-negative",
};

function WinOddsTool({ tender }: { tender: Tender }) {
  const router = useRouter();
  const defaultBudget = tender.budget || 10_000_000;
  const [budget, setBudget] = useState(defaultBudget);
  const [price, setPrice] = useState(Math.round(defaultBudget * 0.92));
  const [hasPartner, setHasPartner] = useState(false);
  const [leadTime, setLeadTime] = useState(30);
  const [criterion, setCriterion] = useState<AwardCriterion>("best_value");
  const [priceWeight, setPriceWeight] = useState(40);
  const [county, setCounty] = useState(tender.county || "");
  const [contractType, setContractType] = useState<ContractType>(tender.contract_type || "servicii");
  const [regime, setRegime] = useState<LegalRegime | "">("");
  const [intellectual, setIntellectual] = useState(false);
  const [annualCost, setAnnualCost] = useState(0);
  const [years, setYears] = useState(0);
  const [stateBudget, setStateBudget] = useState(true);
  const [result, setResult] = useState<WinOdds | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dossier, setDossier] = useState<JustificationDossier | null>(null);
  const [dossierLoading, setDossierLoading] = useState(false);
  const [companyName, setCompanyName] = useState("");
  const [costNotes, setCostNotes] = useState("");

  const qualityBased = criterion === "best_value" || criterion === "best_cost";
  const costBased = criterion === "best_cost" || criterion === "lowest_cost";

  const handleCalculate = async () => {
    if (budget <= 0 || price <= 0) {
      setError("Bugetul și prețul ofertat trebuie să fie valori pozitive.");
      return;
    }
    setLoading(true);
    setError(null);
    setDossier(null);
    try {
      setResult(
        await predictWinRate(budget, price, hasPartner, leadTime, {
          awardCriterion: criterion,
          priceWeightPct: qualityBased ? priceWeight : 100,
          county,
          cpvCode: tender.cpv_code,
          regime: regime || null,
          contractType,
          authorityName: tender.entity_name || null,
          intellectualServices: intellectual,
          annualOperatingCostRon: costBased ? annualCost : null,
          lifecycleYears: costBased ? years : null,
          stateBudgetFunded: stateBudget,
        })
      );
    } catch (e) {
      setError(e instanceof ApiError ? e.detail : "Calculul nu a putut fi finalizat.");
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateDossier = async () => {
    setDossierLoading(true);
    setError(null);
    try {
      setDossier(
        await generateJustificationDossier({
          company_name: companyName.trim() || "[denumirea ofertantului]",
          project_title: tender.project_title || "[denumirea procedurii]",
          estimated_value_ron: budget,
          proposed_price_ron: price,
          cost_notes: costNotes.trim() || undefined,
        })
      );
    } catch (e) {
      setError(e instanceof ApiError ? e.detail : "Fundamentarea nu a putut fi generată.");
    } finally {
      setDossierLoading(false);
    }
  };

  const ratio = budget > 0 ? (price / budget) * 100 : 0;
  const strategy = result?.strategy;
  const risk = strategy?.abnormally_low_risk;
  const check = strategy?.criterion_check;
  const meta = result?.legal_regime;

  return (
    <Panel className="p-4 sm:p-6">
      <h2 className="font-display text-2xl font-bold leading-tight tracking-tight">Poziționare financiară</h2>
      <p className="font-body mt-1.5 text-sm leading-relaxed text-stock-600">
        Simulează oferta pe criteriul de atribuire al procedurii, verifică dacă acel criteriu este permis pentru valoarea
        contractului și arată ambele căi prin care vi se poate cere justificarea prețului.
      </p>

      <div className="mt-6 grid grid-cols-1 gap-5 sm:grid-cols-2">
        <Field label="Valoarea estimată (RON, fără TVA)">
          <NumberInput min={0} value={budget} onValueChange={setBudget} />
        </Field>
        <Field
          label="Preț ofertat (RON, fără TVA)"
          hint={`${ratio.toFixed(2)}% din estimare${ratio > 0 && ratio < 80 ? " — sub pragul de 80%" : ""}`}
        >
          <NumberInput min={0} value={price} onValueChange={setPrice} />
        </Field>
        <Field label="Criteriu de atribuire">
          <Select value={criterion} onChange={(e) => setCriterion(e.target.value as AwardCriterion)}>
            {CRITERIA.map((c) => (
              <option key={c.id} value={c.id}>
                {c.label}
              </option>
            ))}
          </Select>
        </Field>
        {qualityBased ? (
          <Field label="Ponderea financiară (%)" hint={`Tehnic: ${100 - priceWeight}% — din fișa de date.`}>
            <NumberInput min={1} max={100} value={priceWeight} onValueChange={(v) => setPriceWeight(Math.max(1, Math.min(100, v)))} />
          </Field>
        ) : (
          <div />
        )}
        <Field label="Tipul contractului">
          <Select value={contractType} onChange={(e) => setContractType(e.target.value as ContractType)}>
            <option value="lucrari">Lucrări</option>
            <option value="produse">Produse</option>
            <option value="servicii">Servicii</option>
            <option value="servicii_sociale">Servicii sociale (Anexa 2)</option>
          </Select>
        </Field>
        <Field label="Regim juridic" hint="Automat: dedus din denumirea autorității.">
          <Select value={regime} onChange={(e) => setRegime(e.target.value as LegalRegime | "")}>
            <option value="">Automat</option>
            <option value="L98">Legea 98/2016 — clasic</option>
            <option value="L99">Legea 99/2016 — sectorial</option>
          </Select>
        </Field>
        <Field label="Județ" hint="Pentru prețurile câștigătoare locale.">
          <Input value={county} onChange={(e) => setCounty(e.target.value)} placeholder="ex. Brașov" />
        </Field>
        <Field label="Zile până la depunere">
          <NumberInput min={0} value={leadTime} onValueChange={setLeadTime} />
        </Field>
      </div>

      {costBased && (
        <div className="neu-pressed mt-5 grid grid-cols-1 gap-5 rounded-2xl bg-paper p-4 sm:grid-cols-2">
          <Field label="Cost anual de operare (RON)" hint="Pentru costul pe ciclul de viață.">
            <NumberInput min={0} value={annualCost} onValueChange={setAnnualCost} />
          </Field>
          <Field label="Durata de utilizare (ani)">
            <NumberInput min={0} max={60} value={years} onValueChange={setYears} />
          </Field>
          <Checkbox
            label="Finanțat exclusiv de la bugetul de stat (rata de 8,2%)"
            checked={stateBudget}
            onChange={(e) => setStateBudget(e.target.checked)}
          />
        </div>
      )}

      <div className="mt-5 flex flex-col gap-1">
        <Checkbox label="Servicii intelectuale (proiectare, consultanță etc.)" checked={intellectual} onChange={(e) => setIntellectual(e.target.checked)} />
        <Checkbox label="Consorțiu sau subcontractant local" checked={hasPartner} onChange={(e) => setHasPartner(e.target.checked)} />
      </div>

      {error && (
        <div className="mt-5">
          <Notice tone="alert">{error}</Notice>
        </div>
      )}

      <Button onClick={handleCalculate} disabled={loading} fullWidth className="mt-6">
        {loading ? "Se simulează…" : "Simulează oferta"}
      </Button>

      {result && !loading && strategy?.status === "success" && (
        <div className="mt-8 space-y-6">
          {check && !check.allowed && (
            <Notice tone="alert" title="Criteriu de atribuire nepermis">
              {check.issues.join(" ")}
            </Notice>
          )}

          <div className="neu-flat rounded-3xl bg-paper p-6">
            <Eyebrow className="text-editorial">Evaluare</Eyebrow>
            <p className="font-display mt-2 text-3xl font-semibold leading-tight sm:text-4xl">{result.assessment}</p>
            <div className="font-mono mt-4 flex flex-wrap gap-x-5 gap-y-1 border-t border-divider pt-4 text-[11px] uppercase tracking-widest text-stock-500">
              <span>
                Raport <span className="tabular text-ink">{strategy.ratio_pct?.toFixed(2)}%</span>
              </span>
              <span>
                Discount <span className="tabular text-ink">{result.discount_percentage}%</span>
              </span>
              {meta?.procedure_name && <span>{meta.procedure_name} · {meta.applicable_law}</span>}
            </div>
          </div>

          {/* The bid manager's strip: what the money side of this bid costs
              before a single point is scored. */}
          {strategy.guarantees && (
            <div className="rule-grid grid grid-cols-2 sm:grid-cols-4">
              <div className="p-4">
                <Eyebrow>Garanție participare</Eyebrow>
                <p className="tabular font-display mt-1.5 text-lg font-semibold leading-none">
                  max {formatRon(strategy.guarantees.participation_max_ron)}
                </p>
                <p className="font-mono mt-1 text-[10px] text-stock-500">≤ 1% din estimare</p>
              </div>
              <div className="p-4">
                <Eyebrow>Garanție bună execuție</Eyebrow>
                <p className="tabular font-display mt-1.5 text-lg font-semibold leading-none">
                  max {formatRon(strategy.guarantees.performance_max_ron)}
                </p>
                <p className="font-mono mt-1 text-[10px] text-stock-500">≤ 10% din prețul ofertat</p>
              </div>
              <div className="p-4">
                <Eyebrow>Prag 80%</Eyebrow>
                <p className="tabular font-display mt-1.5 text-lg font-semibold leading-none">{formatRon(risk?.threshold_ron)}</p>
                <p className="font-mono mt-1 text-[10px] text-stock-500">sub el: prezumție</p>
              </div>
              <div className="p-4">
                <Eyebrow>Cauțiune CNSC</Eyebrow>
                <p className="tabular font-display mt-1.5 text-lg font-semibold leading-none">
                  {meta?.cautiune ? formatRon(meta.cautiune.pre_submission_ron) : "—"}
                </p>
                <p className="font-mono mt-1 text-[10px] text-stock-500">
                  {meta?.cnsc_deadline_days ? `termen ${meta.cnsc_deadline_days} zile` : "achiziție directă: instanță"}
                </p>
              </div>
            </div>
          )}
          {strategy.guarantees && <p className="font-mono -mt-3 text-[10px] text-stock-500">{strategy.guarantees.basis}</p>}

          {risk && (
            <section>
              <span className="flex items-center gap-1.5">
                <SectionTitle note={risk.level}>Prețul aparent neobișnuit de scăzut</SectionTitle>
                <Explain k="abnormallyLowPrice" className="mb-4" />
              </span>
              <div className={"neu-pressed rounded-2xl border-l-[3px] bg-paper p-4 " + (RISK_BORDER[risk.code] ?? "border-divider")}>
                <p className="font-body text-sm leading-relaxed">{risk.detail}</p>
              </div>
              <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="neu-pressed rounded-2xl bg-paper p-4">
                  <Eyebrow className={risk.presumption_triggered ? "text-negative" : "text-stock-500"}>
                    Calea 1 · prezumția sub 80% {risk.presumption_triggered ? "— se aplică" : "— nu se aplică"}
                  </Eyebrow>
                  <p className="font-body mt-1.5 text-xs leading-relaxed text-stock-600">{risk.track1}</p>
                  <p className="font-mono mt-1.5 text-[10px] text-stock-500">{risk.presumption_basis}</p>
                </div>
                <div className="neu-pressed rounded-2xl bg-paper p-4">
                  <Eyebrow className="text-warning">Calea 2 · elementele de preț — se aplică mereu</Eyebrow>
                  <p className="font-body mt-1.5 text-xs leading-relaxed text-stock-600">{risk.track2}</p>
                  <p className="font-mono mt-1.5 text-[10px] text-stock-500">{risk.element_audit_basis}</p>
                </div>
              </div>

              <details className="mt-3" open={risk.code !== "no_presumption"}>
                <summary className="label-eyebrow cursor-pointer text-stock-500 hover:text-ink">
                  Verificarea pe elemente înainte de depunere ({risk.element_audit.length})
                </summary>
                <ol className="mt-2 divide-y divide-divider">
                  {risk.element_audit.map((e) => (
                    <li key={e.key} className="py-2.5">
                      <p className="font-body text-sm font-semibold">{e.label}</p>
                      <p className="font-body mt-0.5 text-sm leading-relaxed text-stock-600">{e.check}</p>
                      <p className="font-mono mt-1 text-[10px] leading-relaxed text-stock-500">
                        Dovezi: {e.evidence} · {e.basis}
                      </p>
                    </li>
                  ))}
                </ol>
              </details>

              {risk.legal_basis?.length > 0 && (
                <details className="mt-3">
                  <summary className="label-eyebrow cursor-pointer text-stock-500 hover:text-ink">
                    Textul articolelor ({risk.legal_basis.length})
                  </summary>
                  <div className="mt-2 space-y-3">
                    {risk.legal_basis.map((a) => (
                      <div key={a.citation} className="neu-pressed rounded-2xl bg-paper p-3">
                        <p className="font-mono text-[11px] font-semibold text-editorial">{a.citation}</p>
                        <p className="font-body mt-1.5 text-xs leading-relaxed text-stock-600">„{a.text}”</p>
                      </div>
                    ))}
                  </div>
                </details>
              )}

              {risk.requires_justification_dossier && (
                <div className="mt-4 flex flex-col gap-2 sm:flex-row">
                  <Button
                    className="flex-1"
                    onClick={() =>
                      router.push(
                        draftingHref(tender.source_id, "clarificari", {
                          letter: "abnormally_low_price",
                          offered: String(price),
                          estimated: String(budget),
                        })
                      )
                    }
                  >
                    Redactează justificarea prețului (art. 210)
                  </Button>
                </div>
              )}
            </section>
          )}

          {strategy.scenarios && (
            <section>
              <SectionTitle note={strategy.award_criterion_label}>Dacă un rival ofertează…</SectionTitle>
              <div className="neu-pressed mb-3 rounded-2xl bg-paper p-4">
                <p className="font-mono text-xs leading-relaxed text-stock-600">{strategy.scoring_model?.formula}</p>
                <p className="font-body mt-1.5 text-sm leading-relaxed">{strategy.scoring_model?.note}</p>
              </div>
              <div className="scroll-x overflow-x-auto">
                <table className="w-full min-w-[34rem] neu-pressed overflow-hidden rounded-2xl bg-paper text-left font-mono text-xs">
                  <thead>
                    <tr className="border-b border-divider">
                      {["Rivalul la", "Prețul lui", qualityBased ? "Puncte preț (dvs. / el)" : "Rezultat", qualityBased ? "Diferență tehnică" : "Notă"].map((h) => (
                        <th key={h} className="px-3 py-2.5 font-sans text-[10px] font-semibold uppercase tracking-widest text-stock-500">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {strategy.scenarios.map((s) => (
                      <tr key={s.rival_ratio_pct} className="border-b border-divider last:border-b-0">
                        <td className="px-3 py-2.5">{s.rival_ratio_pct}% din estimare</td>
                        <td className="px-3 py-2.5">{formatRon(s.rival_price_ron)}</td>
                        <td className="px-3 py-2.5">
                          {qualityBased ? `${s.your_price_points} / ${s.rival_price_points}` : s.outcome}
                        </td>
                        <td className="px-3 py-2.5 text-editorial">
                          {qualityBased ? s.outcome : s.note || "—"}
                          {qualityBased && s.note && <span className="block text-stock-500">{s.note}</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          {strategy.market_position ? (
            <section>
              <SectionTitle note={`${strategy.market_position.sample_size} atribuiri`}>Față de câștigătorii reali</SectionTitle>
              <p className="font-body text-sm leading-relaxed">
                {strategy.market_position.label} — {strategy.market_position.scope_label}.
              </p>
              <div className="rule-grid mt-3 grid grid-cols-3 sm:grid-cols-5">
                {(["p5", "p25", "p50", "p75", "p95"] as const).map((k) => (
                  <div key={k} className="p-3">
                    <Eyebrow>{k === "p50" ? "Median" : k.toUpperCase()}</Eyebrow>
                    <p className="tabular font-mono mt-1 text-xs">{formatRon(strategy.market_position?.reference_prices_ron[k])}</p>
                  </div>
                ))}
              </div>
            </section>
          ) : (
            result.award_benchmark && (
              <Notice tone="neutral" title="Fără reper de piață încă">
                {result.award_benchmark.reason ||
                  "Prea puține atribuiri comparabile pentru percentile; evaluarea folosește doar regulile legale."}
              </Notice>
            )
          )}

          {strategy.lifecycle && (
            <section>
              <SectionTitle note={strategy.lifecycle.discount_rate ? `rata ${strategy.lifecycle.discount_rate.rate_pct}%` : undefined}>
                Costul pe ciclul de viață
              </SectionTitle>
              {strategy.lifecycle.lifecycle_cost_ron != null ? (
                <div className="neu-pressed rounded-2xl bg-paper p-4">
                  <p className="font-mono text-xs text-stock-600">{strategy.lifecycle.formula}</p>
                  <p className="font-body mt-1.5 text-sm">
                    Preț {formatRon(price)} + costuri actualizate {formatRon(strategy.lifecycle.present_value_operating_ron)} ={" "}
                    <span className="tabular font-semibold">{formatRon(strategy.lifecycle.lifecycle_cost_ron)}</span>
                  </p>
                </div>
              ) : (
                <p className="font-body text-sm text-stock-600">
                  {strategy.lifecycle.note || "Introduceți costul anual și durata pentru a calcula costul pe ciclul de viață."}
                </p>
              )}
              {strategy.lifecycle.discount_rate && (
                <p className="font-mono mt-2 text-[10px] leading-relaxed text-stock-500">
                  {strategy.lifecycle.discount_rate.basis}. {strategy.lifecycle.discount_rate.scope}
                </p>
              )}
            </section>
          )}

          {risk?.requires_justification_dossier && (
            <section className="neu-pressed rounded-2xl bg-paper p-4">
              <Eyebrow className="text-editorial">Schița fundamentării economice, aici</Eyebrow>
              <p className="font-body mt-1.5 text-sm leading-relaxed text-stock-600">
                Structura oficială pe capitolele a)–f) din art. 210 alin. (2), cu dovezile cerute de art. 136 alin. (2) din norme.
              </p>
              <div className="mt-4 space-y-3">
                <Field label="Denumirea ofertantului">
                  <Input value={companyName} onChange={(e) => setCompanyName(e.target.value)} placeholder="SC Exemplu SRL" />
                </Field>
                <Field label="Note despre structura costurilor (opțional)" hint="Utilaje proprii, distanțe, contracte-cadru cu furnizorii.">
                  <Textarea rows={3} value={costNotes} onChange={(e) => setCostNotes(e.target.value)} />
                </Field>
              </div>
              <Button onClick={handleGenerateDossier} disabled={dossierLoading} variant="outline" fullWidth className="mt-4">
                {dossierLoading ? "Se redactează…" : "Generează fundamentarea economică"}
              </Button>
            </section>
          )}

          {dossier && (
            <section>
              <SectionTitle note={`${dossier.chapters.length} capitole`}>{dossier.title}</SectionTitle>
              {!dossier.narrative_available && dossier.narrative_note && (
                <div className="mb-3">
                  <Notice tone="warning">{dossier.narrative_note}</Notice>
                </div>
              )}
              {dossier.narrative && (
                <div className="neu-pressed mb-4 rounded-2xl bg-paper p-4">
                  <p className="font-body whitespace-pre-wrap text-sm leading-relaxed">{dossier.narrative}</p>
                </div>
              )}
              <ol className="divide-y divide-divider">
                {dossier.chapters.map((c) => (
                  <li key={c.letter} className="py-3">
                    <p className="font-body text-sm font-semibold">
                      {c.letter}) {c.title}
                    </p>
                    <p className="font-body mt-1 text-sm leading-relaxed text-stock-600">{c.what_to_provide}</p>
                    <p className="font-mono mt-1.5 text-[11px] leading-relaxed text-stock-500">Dovezi: {c.supporting_evidence}</p>
                  </li>
                ))}
              </ol>
              <p className="font-body mt-4 text-sm leading-relaxed text-stock-600">{dossier.closing_note}</p>
            </section>
          )}

          {result.factors?.length > 0 && (
            <section>
              <SectionTitle note={`${result.factors.length} factori`}>Ce stă în spatele evaluării</SectionTitle>
              <ol className="divide-y divide-divider">
                {result.factors.map((f, i) => (
                  <li key={i} className="flex gap-3 py-3">
                    <span className="tabular font-mono w-6 shrink-0 pt-0.5 text-xs text-stock-400">{String(i + 1).padStart(2, "0")}</span>
                    <p className="font-body flex-1 text-sm leading-relaxed">{f}</p>
                  </li>
                ))}
              </ol>
            </section>
          )}

          <Notice tone="warning" title="Metodologie">
            {result.methodology_note}
          </Notice>
        </div>
      )}
      {result && !loading && strategy?.status === "error" && (
        <div className="mt-6">
          <Notice tone="alert">{strategy.message}</Notice>
        </div>
      )}
    </Panel>
  );
}

/* ------------------------------------------------------------------ shell */

function AnalyticsContent() {
  const searchParams = useSearchParams();
  const requested = searchParams.get("tool") as ToolId | null;
  const [activeTool, setActiveTool] = useState<ToolId>(
    requested && TOOLS.some((t) => t.id === requested) ? requested : "copilot"
  );
  const sourceId = searchParams.get("source_id");
  const [lead, setLead] = useState<Lead | null>(null);
  const [leadState, setLeadState] = useState<"idle" | "loading" | "ready" | "missing">(sourceId ? "loading" : "idle");

  useEffect(() => {
    if (!sourceId) return;
    let mounted = true;
    fetchOpportunity(sourceId)
      .then((l) => {
        if (!mounted) return;
        setLead(l);
        setLeadState("ready");
      })
      .catch(() => mounted && setLeadState("missing"));
    return () => {
      mounted = false;
    };
  }, [sourceId]);

  const tender = tenderFrom(lead, new URLSearchParams(searchParams.toString()));
  // Re-mount the tools once the record arrives so their inputs start from
  // the tender rather than from the fallback URL parameters.
  const toolKey = `${tender.source_id ?? "none"}-${leadState}`;

  return (
    <main className="mx-auto w-full max-w-screen-xl flex-1 px-4 py-6 sm:py-8">
      <PageHeader title="Strategie & Copilot" />

      <TabBar tabs={TOOLS} active={activeTool} onChange={setActiveTool} label="Instrument de analiză" />

      {leadState === "loading" ? (
        <Loading label="Se încarcă licitația" />
      ) : (
        <>
          {leadState === "missing" && (
            <div className="mb-6">
              <Notice tone="warning">Anunțul nu mai există în registru — instrumentele pornesc cu datele din link.</Notice>
            </div>
          )}
          {activeTool !== "copilot" && <TenderBanner tender={tender} />}
          {activeTool === "copilot" && <CopilotTool />}
          {activeTool === "competitor" && <CompetitorTool key={toolKey} tender={tender} />}
          {activeTool === "caiet" && <CaietTool key={toolKey} tender={tender} artifactId={searchParams.get("artifact")} />}
          {activeTool === "win" && <WinOddsTool key={toolKey} tender={tender} />}
        </>
      )}
    </main>
  );
}

export default function AnalyticsPage() {
  return (
    <AuthGate
      title="Instrumentele de strategie sunt pentru abonați"
      description="Copilotul și analizele de ofertare citesc registrul dvs. și necesită un cont autentificat."
    >
      <Suspense
        fallback={
          <main className="mx-auto w-full max-w-screen-xl flex-1 px-4 py-10">
            <Loading />
          </main>
        }
      >
        <AnalyticsContent />
      </Suspense>
    </AuthGate>
  );
}
