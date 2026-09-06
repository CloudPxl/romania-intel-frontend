"use client";
import { Suspense, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import AuthGate from "@/components/AuthGate";
import Explain from "@/components/Explain";
import {
  ApiError,
  analyzeCaietSarcini,
  askCopilotChat,
  fetch72hMarketReport,
  fetchCompetitorAnalysis,
  fetchDocumentExtraction,
  generateJustificationDossier,
  predictWinRate,
  uploadCaietFile,
  uploadCaietFileAsync,
  type AwardCriterion,
  type CaietAnalysis,
  type CompetitorAnalysis,
  type CopilotTurn,
  type JustificationDossier,
  type MacroReport,
  type WinOdds,
} from "@/lib/api";
import { CATEGORIES, formatNumber, formatRon } from "@/lib/format";
import {
  Badge,
  Button,
  Checkbox,
  Eyebrow,
  Field,
  Input,
  Loading,
  Notice,
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
  const [messages, setMessages] = useState<{ sender: "user" | "ai"; text: string; degraded?: boolean }[]>([
    {
      sender: "ai",
      text: "Bună ziua. Pot analiza oportunitățile din registru, cerințele de calificare și strategia de ofertare. Cu ce începem?",
    },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
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
      const data = await askCopilotChat(question, history);
      setMessages((prev) => [...prev, { sender: "ai", text: data.reply, degraded: data.degraded }]);
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
                      {m.degraded ? "Răspuns degradat" : "Copilot"}
                    </span>
                  )}
                  <p className="whitespace-pre-wrap">{m.text}</p>
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
        </Panel>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------- competitor */
function CompetitorTool({ initial }: { initial: { category: string; county: string; budget: string } }) {
  const [category, setCategory] = useState(initial.category || "infrastructura");
  const [county, setCounty] = useState(initial.county || "");
  const [budget, setBudget] = useState(initial.budget ? Number(initial.budget) : 10_000_000);
  const [data, setData] = useState<CompetitorAnalysis | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleAnalyze = async () => {
    if (!county.trim()) {
      setError("Introduceți județul pentru care doriți analiza.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      setData(await fetchCompetitorAnalysis(category, county, budget));
    } catch (e) {
      setError(e instanceof ApiError ? e.detail : "Analiza pieței a eșuat.");
    } finally {
      setLoading(false);
    }
  };

  const market = data?.observed_market;
  const pricing = data?.pricing;
  const awards = data?.award_intelligence;
  // Sorted so the ladder reads from the published estimate downwards
  // rather than in whatever order the object happened to serialise.
  const referencePoints = Object.entries(pricing?.reference_points_ron ?? {}).sort(
    (a, b) => b[1] - a[1]
  );

  return (
    <Panel className="p-4 sm:p-6">
      <h2 className="font-display text-2xl font-bold leading-tight tracking-tight">Profil de piață sectorial</h2>
      <p className="font-body mt-1.5 text-sm leading-relaxed text-stock-600">
        Calculat exclusiv din anunțurile colectate de acest sistem, pentru domeniul și județul selectate.
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
        <Field label="Valoare estimată (RON)">
          <Input type="number" min={0} value={budget} onChange={(e) => setBudget(Number(e.target.value))} />
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

            {/* States which set every figure below was computed over. The
                county used to be counted and then discarded — the median
                and the authority list were national — so asking about Iași
                returned Oradea's water utility and Bucharest's city hall.
                Correct numbers answering a question nobody asked read, at
                the point of use, exactly like invented ones. */}
            {market?.scope_note && (
              <div className="mb-4">
                <Notice tone={market.scope === "county" ? "neutral" : "warning"}>
                  {market.scope_note}
                </Notice>
              </div>
            )}

            <div className="rule-grid grid grid-cols-2 sm:grid-cols-4">
              <div className="p-4">
                <Eyebrow>Proceduri comparabile</Eyebrow>
                <p className="tabular font-display mt-1.5 text-2xl font-semibold leading-none">
                  {formatNumber(market?.comparable_procedures_ingested)}
                </p>
                <p className="font-mono mt-1 text-[10px] text-stock-500">în toată țara</p>
              </div>
              <div className="p-4">
                <Eyebrow>În județul cerut</Eyebrow>
                <p className="tabular font-display mt-1.5 text-2xl font-semibold leading-none">
                  {formatNumber(market?.in_requested_county)}
                </p>
                <p className="font-mono mt-1 text-[10px] text-stock-500">{data.county}</p>
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

          {/* Real outcomes, where any exist. Rendered as its own section
              rather than folded into the market view above, because it
              answers a different question — what winners actually bid —
              and rests on a different, much narrower dataset. */}
          {awards && (
            <section>
              <SectionTitle note={awards.available ? `${awards.sample_size} atribuiri` : "indisponibil"}>
                Rezultate reale de atribuire
              </SectionTitle>
              {!awards.available ? (
                <div className="space-y-4">
                  <Notice tone="warning">{awards.reason}</Notice>
                  {/* The winners are real observations that need no
                      estimate behind them, so they survive the missing
                      discount rather than being discarded with it. */}
                  {awards.recurring_winners?.length ? (
                    <div>
                      <span className="flex items-center gap-1.5">
                        <Eyebrow className="mb-2">Câștigători observați</Eyebrow>
                        <Explain k="recurringWinners" className="mb-2" />
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
                    </div>
                  ) : null}
                </div>
              ) : (
                <div className="space-y-4">
                  {awards.competitive_pressure && (
                    <div className="neu-pressed rounded-2xl bg-paper p-4">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge tone="accent">{awards.competitive_pressure.label}</Badge>
                        <Explain k="competitivePressure" />
                      </div>
                      <p className="font-body mt-2 text-sm leading-relaxed">
                        {awards.competitive_pressure.detail}
                      </p>
                      <p className="font-mono mt-2 text-[10px] leading-relaxed text-stock-500">
                        {awards.competitive_pressure.method_note}
                      </p>
                    </div>
                  )}
                  {awards.winning_discount_pct && (
                    <div className="rule-grid grid grid-cols-2 sm:grid-cols-4">
                      {(
                        [
                          ["Discount median", awards.winning_discount_pct.median],
                          ["Discount mediu", awards.winning_discount_pct.average],
                          ["Minim", awards.winning_discount_pct.min],
                          ["Maxim", awards.winning_discount_pct.max],
                        ] as [string, number][]
                      ).map(([label, v]) => (
                        <div key={label} className="p-4">
                          <Eyebrow>{label}</Eyebrow>
                          <p className="tabular font-display mt-1.5 text-xl font-semibold leading-none">
                            {v.toFixed(1)}%
                          </p>
                        </div>
                      ))}
                    </div>
                  )}
                  {awards.recurring_winners?.length ? (
                    <div>
                      <Eyebrow className="mb-2">Câștigători recurenți (observați)</Eyebrow>
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
                    </div>
                  ) : null}
                </div>
              )}
            </section>
          )}

          {/* The procedures the figures above were computed from, each
              linking straight to its dossier. A number the reader cannot
              trace back to the rows behind it is a number they have to
              take on trust. */}
          {market?.procedures?.length ? (
            <section>
              <SectionTitle note={`${market.procedures.length} dosare`}>
                Procedurile din spatele cifrelor
              </SectionTitle>
              <ul className="divide-y divide-divider">
                {market.procedures.map((p, i) => {
                  const row = (
                    <>
                      <span className="min-w-0 flex-1">
                        <span className="font-body block truncate text-sm font-medium">
                          {p.project_title || "Fără titlu"}
                        </span>
                        <span className="font-mono block truncate text-[11px] text-stock-500">
                          {p.entity_name}
                          {p.county ? ` · ${p.county}` : ""}
                        </span>
                      </span>
                      <span className="tabular font-mono shrink-0 text-xs text-stock-600">
                        {formatRon(p.financial_value_ron ?? 0)}
                      </span>
                    </>
                  );
                  return (
                    <li key={p.source_id || i}>
                      {p.source_id ? (
                        <Link
                          href={`/cautare-avansata?openLead=${encodeURIComponent(p.source_id)}&matches=0`}
                          className="flex items-baseline justify-between gap-3 py-2.5 transition-colors duration-[var(--duration-base)] hover:text-editorial"
                        >
                          {row}
                        </Link>
                      ) : (
                        <span className="flex items-baseline justify-between gap-3 py-2.5">{row}</span>
                      )}
                    </li>
                  );
                })}
              </ul>
            </section>
          ) : null}

          {market?.contracting_authorities_observed?.length ? (
            <section>
              <SectionTitle note={`${market.contracting_authorities_observed.length} entități`}>
                Autorități contractante observate
              </SectionTitle>
              <ul className="divide-y divide-divider">
                {market.contracting_authorities_observed.map((a) => (
                  <li key={a} className="font-body py-2.5 text-sm">
                    {a}
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          {pricing && (
            <section>
              <span className="flex items-center gap-1.5">
                <SectionTitle note="raportate la estimare">Repere de preț</SectionTitle>
                <Explain k="priceReferences" className="mb-4" />
              </span>
              <div className="rule-grid grid grid-cols-2 sm:grid-cols-4">
                {referencePoints.map(([label, value], i) => (
                  <div
                    key={label}
                    className="p-4"
                  >
                    <Eyebrow>{label.replace(/_/g, " ").replace("pct", "%")}</Eyebrow>
                    <p className="tabular font-display mt-1.5 text-xl font-semibold leading-none">
                      {formatRon(value)}
                    </p>
                  </div>
                ))}
              </div>
              <p className="font-mono mt-3 text-[11px] leading-relaxed text-stock-500">
                {pricing.reference_points_note}
              </p>
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

          <Notice tone="warning" title="Limitele analizei">
            {data.data_limitations}
          </Notice>
        </div>
      )}
    </Panel>
  );
}

/* ------------------------------------------------------------------ caiet */

function CaietTool({ initial }: { initial: { project_title: string } }) {
  const [projectTitle, setProjectTitle] = useState(initial.project_title || "");
  const [text, setText] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [result, setResult] = useState<CaietAnalysis | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ocrStatus, setOcrStatus] = useState<"idle" | "queued" | "processing" | "done" | "failed">("idle");
  const [ocrApplied, setOcrApplied] = useState<boolean | null>(null);
  const cancelledRef = useRef(false);

  useEffect(() => {
    cancelledRef.current = false;
    return () => {
      cancelledRef.current = true;
    };
  }, []);

  // A clean document comes back as one sentinel entry with severity "OK",
  // not as an empty list — rendering it verbatim would report "Niciunul"
  // as though it were a restrictive clause.
  const realFlags = (result?.detected_red_flags ?? []).filter((f) => f.severity !== "OK");

  // api.py's synchronous upload-caiet 422s a scanned PDF (no digital text
  // layer) with a message naming this exact async path — matched here so
  // that upload is routed into the real OCR pipeline instead of dead-ending
  // on an API-path name the user can't act on. If that message is ever
  // reworded in api.py, update this check alongside it.
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
          setResult(await analyzeCaietSarcini(title, undefined, doc_id));
          setOcrStatus("done");
          return;
        }
        if (row.status === "failed") {
          setError(row.error_message || "Procesarea OCR a eșuat.");
          setOcrStatus("failed");
          return;
        }
        await new Promise((r) => setTimeout(r, 3000));
      }
      if (!cancelledRef.current) {
        setError("Procesarea OCR durează mai mult decât de obicei — reveniți mai târziu.");
        setOcrStatus("failed");
      }
    } catch (e) {
      if (!cancelledRef.current) {
        setError(e instanceof ApiError ? e.detail : "Procesarea OCR a eșuat.");
        setOcrStatus("failed");
      }
    }
  };

  const handleAnalyze = async () => {
    if (!projectTitle.trim()) {
      setError("Introduceți titlul proiectului analizat.");
      return;
    }
    if (!file && !text.trim()) {
      setError("Încărcați un fișier sau lipiți textul caietului de sarcini.");
      return;
    }
    setLoading(true);
    setError(null);
    setOcrStatus("idle");
    setOcrApplied(null);
    try {
      setResult(file ? await uploadCaietFile(file, projectTitle) : await analyzeCaietSarcini(projectTitle, text));
    } catch (e) {
      if (file && e instanceof ApiError && e.status === 422 && e.detail.includes("upload-caiet-async")) {
        await runAsyncOcrFlow(file, projectTitle);
      } else {
        setError(e instanceof ApiError ? e.detail : "Analiza documentului a eșuat.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <Panel className="p-4 sm:p-6">
      <h2 className="font-display text-2xl font-bold leading-tight tracking-tight">Scanner clauze restrictive</h2>
      <p className="font-body mt-1.5 text-sm leading-relaxed text-stock-600">
        Detectează cerințele care restrâng nejustificat concurența, conform jurisprudenței CNSC.
      </p>

      <div className="mt-6 space-y-5">
        <Field label="Titlu proiect">
          <Input value={projectTitle} onChange={(e) => setProjectTitle(e.target.value)} />
        </Field>

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
            <span className="font-body text-sm font-semibold">
              {file ? file.name : "Alegeți un fișier PDF, DOCX sau TXT"}
            </span>
            <span className="font-mono mt-1 text-[11px] uppercase tracking-wider text-stock-500">
              {file ? `${(file.size / 1024).toFixed(0)} KB · apăsați pentru a schimba` : "sau lipiți textul mai jos"}
            </span>
          </label>
          {file && (
            <button
              onClick={() => setFile(null)}
              className="mt-2 text-sm font-medium text-editorial hover:brightness-110"
            >
              Elimină fișierul
            </button>
          )}
        </div>

        <Field label="Text caiet de sarcini" hint="Ignorat dacă a fost încărcat un fișier.">
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

      <Button onClick={handleAnalyze} disabled={loading} fullWidth className="mt-6">
        {loading ? "Se analizează documentul…" : "Scanează clauzele"}
      </Button>

      {loading && (
        <div className="mt-6">
          <Loading label="Se compară cu jurisprudența CNSC" />
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
          {ocrApplied && (
            <Badge tone="neutral">Document procesat prin OCR (scanare, fără strat de text digital)</Badge>
          )}
          <div className="neu-flat rounded-3xl bg-paper p-5">
            <div className="flex flex-wrap items-baseline justify-between gap-3">
              <div>
                <Eyebrow className="text-editorial">Nivel de risc restrictiv</Eyebrow>
                <p className="font-display mt-1 text-3xl font-semibold leading-tight">
                  {result.bias_risk_level || "—"}
                </p>
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
              <SectionTitle note={`${realFlags.length} identificate`}>Clauze semnalate</SectionTitle>
              <div className="divide-y divide-divider neu-flat overflow-hidden rounded-3xl bg-paper">
                {realFlags.map((flag, i) => (
                  <div key={i} className="p-4">
                    <div className="flex flex-wrap items-baseline justify-between gap-2">
                      <h3 className="font-display text-lg font-semibold capitalize leading-snug">{flag.pattern}</h3>
                      <Badge tone="warning">Risc {flag.severity}</Badge>
                    </div>
                    {flag.matched_terms?.length ? (
                      <p className="font-mono mt-1.5 text-[11px] text-stock-500">
                        Termeni: {flag.matched_terms.join(", ")}
                      </p>
                    ) : null}
                    <p className="font-body mt-2 text-sm leading-relaxed text-stock-700">{flag.tactical_advisory}</p>
                  </div>
                ))}
              </div>
            </section>
          ) : (
            <Notice title="Fără semnalări">
              Nu au fost detectate clauze restrictive dintre tiparele verificate.
            </Notice>
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

          {result.coverage_note && <Notice tone="warning" title="Acoperirea analizei">{result.coverage_note}</Notice>}
        </div>
      )}
    </Panel>
  );
}

/* -------------------------------------------------------------- win odds */

function WinOddsTool({ initial }: { initial: { budget: string } }) {
  const defaultBudget = initial.budget ? Number(initial.budget) : 10_000_000;
  const [budget, setBudget] = useState(defaultBudget);
  const [price, setPrice] = useState(Math.round(defaultBudget * 0.92));
  const [hasPartner, setHasPartner] = useState(true);
  const [leadTime, setLeadTime] = useState(30);
  const [criterion, setCriterion] = useState<AwardCriterion>("lowest_price");
  const [priceWeight, setPriceWeight] = useState(40);
  const [county, setCounty] = useState("");
  const [result, setResult] = useState<WinOdds | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // The Art. 210 defence, generated from the same numbers already on screen.
  const [dossier, setDossier] = useState<JustificationDossier | null>(null);
  const [dossierLoading, setDossierLoading] = useState(false);
  const [companyName, setCompanyName] = useState("");
  const [projectTitle, setProjectTitle] = useState("");
  const [costNotes, setCostNotes] = useState("");

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
          priceWeightPct: criterion === "best_value" ? priceWeight : 100,
          county,
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
          project_title: projectTitle.trim() || "[denumirea procedurii]",
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

  const discountPct = budget > 0 ? ((budget - price) / budget) * 100 : 0;
  const strategy = result?.strategy;
  const risk = strategy?.abnormally_low_risk;

  return (
    <Panel className="p-4 sm:p-6">
      <h2 className="font-display text-2xl font-bold leading-tight tracking-tight">Poziționare financiară</h2>
      <p className="font-body mt-1.5 text-sm leading-relaxed text-stock-600">
        Calculat pe criteriul de atribuire al procedurii: sub „prețul cel mai scăzut” un avantaj tehnic nu compensează
        nimic, iar la „cel mai bun raport calitate-preț” un discount valorează exact cât ponderea prețului.
      </p>

      <div className="mt-6 space-y-5">
        <Field label="Buget estimat al autorității (RON)">
          <Input type="number" min={0} value={budget} onChange={(e) => setBudget(Number(e.target.value))} />
        </Field>
        <Field label="Preț ofertat propus (RON)" hint={`Discount curent: ${discountPct.toFixed(1)}%`}>
          <Input type="number" min={0} value={price} onChange={(e) => setPrice(Number(e.target.value))} />
        </Field>
        <Field label="Criteriu de atribuire">
          <Select value={criterion} onChange={(e) => setCriterion(e.target.value as AwardCriterion)}>
            <option value="lowest_price">Prețul cel mai scăzut</option>
            <option value="best_value">Cel mai bun raport calitate-preț</option>
          </Select>
        </Field>
        {criterion === "best_value" && (
          <Field
            label="Ponderea prețului (%)"
            hint={`Tehnic: ${100 - priceWeight}% — din fișa de date a procedurii.`}
          >
            <Input
              type="number"
              min={1}
              max={100}
              value={priceWeight}
              onChange={(e) => setPriceWeight(Math.max(1, Math.min(100, Number(e.target.value))))}
            />
          </Field>
        )}
        <Field label="Județ (opțional)" hint="Aduce discounturile câștigătoare reale, dacă avem atribuiri ingerate.">
          <Input value={county} onChange={(e) => setCounty(e.target.value)} placeholder="ex. Brașov" />
        </Field>
        <Field label="Timp până la depunere (zile)">
          <Input type="number" min={0} value={leadTime} onChange={(e) => setLeadTime(Number(e.target.value))} />
        </Field>
        <Checkbox
          label="Consorțiu sau subcontractant local în județul autorității"
          checked={hasPartner}
          onChange={(e) => setHasPartner(e.target.checked)}
        />
      </div>

      {error && (
        <div className="mt-5">
          <Notice tone="alert">{error}</Notice>
        </div>
      )}

      <Button onClick={handleCalculate} disabled={loading} fullWidth className="mt-6">
        {loading ? "Se evaluează…" : "Evaluează poziționarea"}
      </Button>

      {result && !loading && (
        <div className="mt-8 space-y-6">
          <div className="neu-flat rounded-3xl bg-paper p-6">
            <Eyebrow className="text-editorial">Evaluare poziționare</Eyebrow>
            <p className="font-display mt-2 text-4xl font-semibold leading-none">{result.assessment}</p>
            <div className="font-mono mt-4 flex flex-wrap gap-x-5 gap-y-1 border-t border-divider pt-4 text-[11px] uppercase tracking-widest text-stock-500">
              <span>
                Discount <span className="tabular text-ink">{result.discount_percentage}%</span>
              </span>
              <span>
                Interval <span className="text-ink">{result.competitiveness_band.replace(/_/g, " ")}</span>
              </span>
              <span>
                Ofertă <span className="tabular text-ink">{formatRon(result.proposed_price_ron)}</span>
              </span>
            </div>
          </div>

          {/* What the award criterion actually costs you. Under best value
              a competitor's undercut converts into a number of technical
              points you must make up — which is the decision, not an
              adjective about competitiveness. */}
          {strategy?.scoring_model && (
            <section>
              <SectionTitle note={strategy.award_criterion_label}>Modelul de punctaj</SectionTitle>
              <div className="neu-pressed rounded-2xl bg-paper p-4">
                <p className="font-mono text-xs leading-relaxed text-stock-600">
                  {strategy.scoring_model.formula}
                </p>
                <p className="font-body mt-2 text-sm leading-relaxed">{strategy.scoring_model.note}</p>
              </div>
              {strategy.scoring_model.undercut_scenarios && (
                <div className="scroll-x mt-4 overflow-x-auto">
                  <table className="w-full min-w-[34rem] neu-pressed overflow-hidden rounded-2xl bg-paper text-left font-mono text-xs">
                    <thead>
                      <tr className="border-b border-divider">
                        {["Dacă vă subcotează cu", "Prețul lui", "Punctajul dvs. pe preț", "Trebuie recuperat tehnic"].map(
                          (h) => (
                            <th key={h} className="px-3 py-2.5 font-sans text-[10px] font-semibold uppercase tracking-widest text-stock-500">
                              {h}
                            </th>
                          )
                        )}
                      </tr>
                    </thead>
                    <tbody>
                      {strategy.scoring_model.undercut_scenarios.map((s) => (
                        <tr key={s.competitor_undercuts_you_by_pct} className="border-b border-divider last:border-b-0">
                          <td className="px-3 py-2.5">{s.competitor_undercuts_you_by_pct}%</td>
                          <td className="px-3 py-2.5">{formatRon(s.competitor_price_ron)}</td>
                          <td className="px-3 py-2.5">
                            {s.your_price_points} / {strategy.price_weight_pct}
                          </td>
                          <td className="px-3 py-2.5 text-editorial">
                            {s.price_points_lost} pct
                            {s.technical_advantage_needed_pct_of_technical_weight != null &&
                              ` (${s.technical_advantage_needed_pct_of_technical_weight}% din tehnic)`}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          )}

          {/* Art. 210 exposure. The legal position is rendered verbatim
              because the 80% rule people act on is from the repealed OUG
              34/2006, and a paraphrase is how it creeps back. */}
          {risk && (
            <section>
              <span className="flex items-center gap-1.5">
                <SectionTitle note={risk.level}>Expunere la prețul neobișnuit de scăzut</SectionTitle>
                <Explain k="abnormallyLowPrice" className="mb-4" />
              </span>
              <div
                className={
                  "neu-pressed rounded-2xl bg-paper p-4 border-l-[3px] " +
                  (risk.code === "low" ? "border-positive" : risk.code === "moderate" ? "border-warning" : "border-negative")
                }
              >
                <p className="font-body text-sm leading-relaxed">{risk.detail}</p>
                <p className="font-mono mt-2 text-[10px] uppercase tracking-widest text-stock-500">
                  Declanșator: {risk.trigger_used}
                </p>
              </div>

              <div className="mt-3 flex items-start gap-1.5">
                <Notice tone="neutral" title="Poziția legală">
                  {risk.legal_position}
                </Notice>
                <Explain k="eightyPercentMyth" className="mt-3" />
              </div>

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
                <div className="neu-pressed mt-4 rounded-2xl bg-paper p-4">
                  <Eyebrow className="text-editorial">Pregătiți fundamentarea acum</Eyebrow>
                  <p className="font-body mt-1.5 text-sm leading-relaxed text-stock-600">
                    Generăm structura oficială pe capitolele a)–f) din art. 210 alin. (2), cu dovezile cerute de
                    art. 136 alin. (2) din norme. O fundamentare pregătită și necerută nu costă nimic; una cerută și
                    nepregătită pierde procedura.
                  </p>
                  <div className="mt-4 space-y-3">
                    <Field label="Denumirea ofertantului">
                      <Input value={companyName} onChange={(e) => setCompanyName(e.target.value)} placeholder="SC Exemplu SRL" />
                    </Field>
                    <Field label="Denumirea procedurii">
                      <Input value={projectTitle} onChange={(e) => setProjectTitle(e.target.value)} placeholder="Modernizare DJ 103" />
                    </Field>
                    <Field label="Note despre structura costurilor (opțional)" hint="Utilaje proprii, distanțe, contracte-cadru cu furnizorii.">
                      <Textarea rows={3} value={costNotes} onChange={(e) => setCostNotes(e.target.value)} />
                    </Field>
                  </div>
                  <Button onClick={handleGenerateDossier} disabled={dossierLoading} fullWidth className="mt-4">
                    {dossierLoading ? "Se redactează…" : "Generează fundamentarea economică"}
                  </Button>
                </div>
              )}
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
                    <p className="font-mono mt-1.5 text-[11px] leading-relaxed text-stock-500">
                      Dovezi: {c.supporting_evidence}
                    </p>
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
                    <span className="tabular font-mono w-6 shrink-0 pt-0.5 text-xs text-stock-400">
                      {String(i + 1).padStart(2, "0")}
                    </span>
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

  const initial = {
    category: searchParams.get("category") || "",
    county: searchParams.get("county") || "",
    budget: searchParams.get("budget") || "",
    project_title: searchParams.get("project_title") || "",
  };

  return (
    <main className="mx-auto w-full max-w-screen-xl flex-1 px-4 py-6 sm:py-8">
      <PageHeader title="Copilot AI" />

      <TabBar tabs={TOOLS} active={activeTool} onChange={setActiveTool} label="Instrument de analiză" />

      {activeTool === "copilot" && <CopilotTool />}
      {activeTool === "competitor" && <CompetitorTool initial={initial} />}
      {activeTool === "caiet" && <CaietTool initial={initial} />}
      {activeTool === "win" && <WinOddsTool initial={initial} />}
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
