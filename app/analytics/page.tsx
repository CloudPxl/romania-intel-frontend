"use client";
import { Suspense, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ChevronDown } from "lucide-react";
import AuthGate from "@/components/AuthGate";
import AuthorityProfilePanel from "@/components/AuthorityProfilePanel";
import Explain from "@/components/Explain";
import LeadDossierPanel from "@/components/LeadDossierPanel";
import { useActiveTender, useCopilot } from "@/context/CopilotContext";
import {
  ApiError,
  analyzeCaietSarcini,
  contractTypeFromCpv,
  fetchArtifact,
  fetchCaietInsight,
  fetchCompetitorAnalysis,
  fetchDocumentExtraction,
  fetchOpportunity,
  predictWinRate,
  uploadCaietFile,
  uploadCaietFileAsync,
  type AwardCriterion,
  type CaietAnalysis,
  type CaietFlag,
  type CaietInsight,
  type CompetitorAnalysis,
  type ContractType,
  type Lead,
  type LegalRegime,
  type WinOdds,
} from "@/lib/api";
import { PRE_SEAP_FOIA_PRESETS, draftingHref, foiaHref, stashClauses } from "@/lib/toolLinks";
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
  Explainer,
  TabBar,
  Textarea,
  Tooltip,
} from "@/components/newsprint";

/** Upload ceiling, mirrored from the server (addons/upload_guard.py). */
const MAX_UPLOAD_MB = 15;

// The copilot is no longer a tab here: it floats on every page
// (components/CopilotWidget.tsx), where it can see the dossier being read.
const TOOLS = [
  { id: "competitor", label: "Profil de piață" },
  { id: "caiet", label: "Scanner caiet sarcini" },
  { id: "win", label: "Poziționare preț" },
] as const;

type ToolId = (typeof TOOLS)[number]["id"];

/** Case- and diacritics-insensitive key, for merging the regex and AI
 *  requirement lists without showing the same requirement twice. */
function fold(text: string): string {
  return text.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

/** The one-line "how to use this" above each tool's inputs. */
function Hint({ children }: { children: React.ReactNode }) {
  return <p className="font-body mt-1.5 text-sm leading-relaxed text-stock-600">{children}</p>;
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
  /** The tender's procedure: a direct purchase gets no 80% presumption. */
  procedure_type: string | null;
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
    procedure_type: lead?.procedure_type || params.get("procedure_type") || null,
  };
}

function TenderBanner({ tender }: { tender: Tender }) {
  if (!tender.source_id) return null;
  return (
    <div className="mb-6 rounded-xl border border-line-strong bg-paper px-5 py-4">
      <Eyebrow className="text-accent">Licitația analizată · <span className="tabular normal-case tracking-normal">{tender.source_id}</span></Eyebrow>
      <p className="mt-1 text-[16px] font-semibold leading-snug">{tender.project_title}</p>
      <p className="tabular mt-1 text-[13px] text-stock-500">
        {[tender.entity_name, tender.county, tender.cpv_code && `CPV ${tender.cpv_code}`, tender.budget && formatRon(tender.budget)]
          .filter(Boolean)
          .join(" · ")}
      </p>
    </div>
  );
}

/* ------------------------------------------------------------- competitor */

/** The five points of what winners actually bid, as a share of the
 *  estimate. P5/P95 stay in the API for the price-position bands. */
const PRICE_POINTS = [
  { key: "p10", label: "P10", tip: "Doar 10% dintre câștigători au ofertat mai jos — ofertă foarte agresivă." },
  { key: "p25", label: "P25", tip: "Ofertă agresivă: un sfert dintre câștigători au fost sub acest preț (cuartila de top)." },
  { key: "p50", label: "Mediana", tip: "Oferta câștigătoare tipică: jumătate dintre câștigători au fost sub, jumătate peste." },
  { key: "p75", label: "P75", tip: "Trei sferturi dintre câștigători au ofertat sub acest preț." },
  { key: "p90", label: "P90", tip: "Aproape plafonul: 90% dintre câștigători au fost sub acest preț." },
] as const;
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
      <h2 className="font-display text-2xl font-bold leading-tight tracking-tight">Profil de piață</h2>
      <Hint>
        Selectați domeniul și județul, introduceți valoarea estimată a licitației și vedeți cu ce % din buget s-au câștigat
        contractele reale și ce companii domină autoritatea.
      </Hint>

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
            {/* Said only when it changes how to read the figures: a national
                fallback must never pass for a local finding. */}
            {market?.scope === "national" && market.scope_note && (
              <p className="font-mono -mt-2 mb-3 text-[11px] text-warning">{market.scope_note}</p>
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
                <div className="rule-grid grid grid-cols-2 sm:grid-cols-5">
                  {PRICE_POINTS.map(({ key, label, tip }) => (
                    <div key={key} className={"p-4 " + (key === "p50" ? "neu-pressed-sm rounded-2xl" : "")}>
                      <Tooltip label={tip}>
                        <Eyebrow className={key === "p50" ? "text-accent" : undefined}>{label}</Eyebrow>
                      </Tooltip>
                      <p className="tabular font-display mt-1.5 text-lg font-semibold leading-none">
                        {formatRon(pct.prices_ron[key] ?? null)}
                      </p>
                      <p className="font-mono mt-1 text-[10px] text-stock-500">
                        {pct.ratio_pct[key] != null ? `${pct.ratio_pct[key].toFixed(1)}% din buget` : "—"}
                      </p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="font-body text-sm leading-relaxed text-stock-600">{pricing.reference_points_note}</p>
              )}

              {/* The 80% rule, once: the figure and how often real winners
                  went under it. The law itself is one tap away. */}
              {statutory && (
                <div className="mt-4 flex flex-wrap items-center gap-2">
                  <span className="neu-pressed-sm inline-flex flex-wrap items-center gap-x-2 gap-y-0.5 rounded-full px-3.5 py-1.5 font-mono text-[11px] text-ink">
                    <span className="font-sans font-semibold text-warning">Prag 80% · art. 136 alin. (4) HG 395/2016</span>
                    <span className="tabular font-semibold">{formatRon(statutory.price_ron)}</span>
                    {pct?.below_80pct_share != null && (
                      <span className="text-stock-500">· {pct.below_80pct_share}% dintre câștigători au fost sub prag</span>
                    )}
                  </span>
                  <Explain k="abnormallyLowPrice" />
                  {pct?.single_offer?.rate_pct != null && (
                    <span className="neu-pressed-sm inline-flex rounded-full px-3.5 py-1.5 font-mono text-[11px] text-stock-600">
                      Ofertă unică probabilă: {pct.single_offer.rate_pct}% din {pct.single_offer.sample_size} contracte
                    </span>
                  )}
                </div>
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
                      className="flex w-full items-baseline justify-between gap-3 py-2.5 text-left transition-colors duration-[var(--duration-base)] hover:text-accent disabled:cursor-default"
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
                      className="flex w-full items-baseline justify-between gap-3 py-2.5 text-left transition-colors hover:text-accent"
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

        </div>
      )}

      {openLead && <LeadDossierPanel lead={openLead} onClose={() => setOpenLead(null)} />}
      {authority && <AuthorityProfilePanel cui={authority.cui} name={authority.name} onClose={() => setAuthority(null)} />}
    </Panel>
  );
}

/* ------------------------------------------------------------------ caiet */

const SEVERITY_TONE: Record<string, "negative" | "warning" | "neutral"> = { Critic: "negative", Ridicat: "warning" };

/** The regex engine's lists, mapped onto the AI pass's groups so one
 *  requirement is shown once whichever pass found it. */
const REQUIREMENT_GROUPS: { key: string; label: string; regex?: keyof NonNullable<CaietAnalysis["qualification_criteria"]> }[] = [
  { key: "turnover", label: "Cifră de afaceri", regex: "turnover_requirements" },
  { key: "similar_experience", label: "Experiență similară" },
  { key: "certifications", label: "Certificări și autorizații", regex: "required_certifications" },
  { key: "key_personnel", label: "Personal-cheie", regex: "key_personnel_roles" },
  { key: "equipment", label: "Echipamente și dotări", regex: "mandatory_equipment" },
  { key: "other", label: "Alte cerințe" },
];

function riskLabel(level?: string | null): string {
  const folded = fold(level || "");
  if (folded.startsWith("critic")) return "Critic";
  if (folded.startsWith("moderat")) return "Moderat";
  if (folded.startsWith("scazut")) return "Scăzut";
  return level || "—";
}

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
  const [insight, setInsight] = useState<CaietInsight | null>(null);
  const [insightLoading, setInsightLoading] = useState(false);
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
        const payload = a.payload as {
          project_title?: string;
          bias_score?: number;
          bias_risk_level?: string;
          flags?: CaietFlag[];
          document_sha256?: string;
        };
        setProjectTitle(payload.project_title || projectTitle);
        setResult({
          project_title: payload.project_title,
          bias_score: payload.bias_score,
          bias_risk_level: payload.bias_risk_level,
          detected_red_flags: payload.flags || [],
          // Lets the reopened scan show its cached AI analysis too.
          document_sha256: payload.document_sha256,
        });
        setFromArtifact(a.created_at);
      })
      .catch(() => setError("Scanarea salvată nu a putut fi încărcată."));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [artifactId]);

  const realFlags = (result?.detected_red_flags ?? []).filter((f) => f.severity !== "OK");
  const traps = insight?.status === "ready" ? insight.traps ?? [] : [];
  const allFlags: CaietFlag[] = [...realFlags, ...traps];
  const flagKey = (f: CaietFlag, i: number) => f.flag_id || `${f.pattern}-${i}`;

  // The AI pass, as soon as the deterministic result is on screen — the
  // user reads the regex findings while the model reads the document. One
  // analysis per document hash: a repeat scan comes back from cache.
  useEffect(() => {
    setInsight(null);
    const sha = result?.document_sha256;
    if (!sha) {
      setInsightLoading(false);
      return;
    }
    let mounted = true;
    setInsightLoading(true);
    fetchCaietInsight({
      project_title: projectTitle,
      document_sha256: sha,
      source_id: tender.source_id,
      regex_flags: realFlags.map((f) => f.pattern),
      regex_score: result?.bias_score ?? null,
    })
      .then((i) => mounted && setInsight(i))
      .catch((e) => mounted && setInsight({ status: "unavailable", reason: e instanceof ApiError ? e.detail : "Analiza AI nu a răspuns." }))
      .finally(() => mounted && setInsightLoading(false));
    return () => {
      mounted = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [result]);

  // Everything flagged starts selected: the common case is "contest all of
  // it", and unticking is one click per clause. AI findings join the
  // selection when they arrive.
  useEffect(() => {
    setSelected(new Set(allFlags.map(flagKey)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [result, insight]);

  const nzFlagged = realFlags.some((f) => fold(f.pattern).includes("zero net"));

  // One requirement once, whichever pass found it; a group with nothing in
  // it is not drawn at all.
  const requirementGroups = REQUIREMENT_GROUPS.map((g) => {
    const items: { text: string; quote: string | null }[] = [
      ...((insight?.status === "ready" && insight.requirements?.find((r) => r.key === g.key)?.items) || []),
    ];
    const regexItems = g.regex ? (result?.qualification_criteria?.[g.regex] as string[] | undefined) ?? [] : [];
    for (const raw of regexItems) {
      const key = fold(raw);
      if (key && !items.some((it) => fold(it.text).includes(key))) items.push({ text: raw, quote: null });
    }
    return { ...g, items };
  }).filter((g) => g.items.length > 0);

  // Same ceiling the server enforces (addons/upload_guard.py): refused here,
  // with the way forward, before minutes of upload on a slow connection.
  const pickFile = (f: File | null) => {
    if (f && f.size > MAX_UPLOAD_MB * 1024 * 1024) {
      setFile(null);
      setError(
        `Fișierul are ${(f.size / 1024 / 1024).toFixed(1)} MB; limita este ${MAX_UPLOAD_MB} MB. ` +
          "Încărcați doar caietul de sarcini și fișa de date (fără anexele desenate) sau lipiți textul cerințelor."
      );
      return;
    }
    setError(null);
    setFile(f);
  };

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
      } else if (e instanceof ApiError) {
        setError(e.detail);
      } else {
        // No HTTP answer at all: a dropped connection, or a proxy that
        // refused the upload before the API saw it.
        setError(
          file
            ? "Fișierul nu a ajuns la server (conexiune întreruptă sau document prea mare). Reîncercați, încărcați doar secțiunile cu cerințele sau lipiți textul."
            : "Analiza documentului a eșuat. Reîncercați."
        );
      }
    } finally {
      setLoading(false);
    }
  };

  const forwardToDrafting = (only?: CaietFlag[]) => {
    const chosen = only ?? allFlags.filter((f, i) => selected.has(flagKey(f, i)));
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
      <h2 className="font-display text-2xl font-bold leading-tight tracking-tight">Scanner caiet de sarcini</h2>
      <Hint>
        Încărcați caietul (PDF, DOCX) sau lipiți textul: primiți sinteza, cerințele de calificare și clauzele restrictive,
        fiecare gata de trimis în solicitarea de clarificări.
      </Hint>

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
              onChange={(e) => pickFile(e.target.files?.[0] || null)}
              className="sr-only"
            />
            <span className="font-body text-sm font-semibold">{file ? file.name : "Alegeți un fișier PDF, DOCX sau TXT"}</span>
            <span className="font-mono mt-1 text-[11px] uppercase tracking-wider text-stock-500">
              {file
                ? `${(file.size / 1024).toFixed(0)} KB · apăsați pentru a schimba`
                : `PDF, DOCX sau TXT, până la ${MAX_UPLOAD_MB} MB · PDF scanat? îl trecem prin OCR automat`}
            </span>
          </label>
          {file && (
            <button onClick={() => setFile(null)} className="mt-2 text-sm font-medium text-accent hover:brightness-110">
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
        <div className="mt-8 space-y-7">
          {(fromArtifact || ocrApplied || insight?.cached) && (
            <div className="flex flex-wrap gap-2">
              {fromArtifact && <Badge tone="neutral">Scanare salvată din {formatDate(fromArtifact)}</Badge>}
              {ocrApplied && <Badge tone="neutral">Document scanat, citit prin OCR</Badge>}
              {insight?.cached && <Badge tone="neutral">Analiză AI din cache · 0 credite</Badge>}
            </div>
          )}

          <div className="neu-flat rounded-3xl bg-paper p-5">
            <div className="flex flex-wrap items-baseline justify-between gap-3">
              <div>
                <Eyebrow className="text-accent">Risc restrictiv</Eyebrow>
                <p className="font-display mt-1 text-3xl font-semibold leading-tight">
                  {riskLabel(insight?.risk?.level ?? result.bias_risk_level)}
                </p>
              </div>
              {(insight?.risk?.score ?? result.bias_score) != null && (
                <p className="tabular font-display text-4xl font-semibold">
                  {insight?.risk?.score ?? result.bias_score}
                  <span className="font-mono text-sm font-normal tracking-widest text-stock-500"> / 10</span>
                </p>
              )}
            </div>
            <p className="font-mono mt-3 border-t border-divider pt-3 text-[11px] text-stock-500">
              {realFlags.length} {realFlags.length === 1 ? "semnalare" : "semnalări"} din verificarea legală
              {insightLoading
                ? " · analiza AI citește documentul…"
                : insight?.status === "ready"
                  ? ` · ${traps.length} ${traps.length === 1 ? "capcană identificată" : "capcane identificate"} de AI`
                  : ""}
            </p>
          </div>

          {insightLoading && <Loading label="Analiza AI citește documentul" />}
          {insight?.status === "unavailable" && insight.reason && (
            <p className="font-body text-sm text-stock-500">Analiza AI: {insight.reason}</p>
          )}

          {insight?.status === "ready" && insight.summary && insight.summary.length > 0 && (
            <section>
              <SectionTitle note={insight.truncated ? "document lung · extras" : undefined}>Pe scurt</SectionTitle>
              <ul className="divide-y divide-divider neu-flat overflow-hidden rounded-3xl bg-paper">
                {insight.summary.map((line) => (
                  <li key={line.label} className="p-4">
                    <Eyebrow>{line.label}</Eyebrow>
                    <p className="font-body mt-1 text-sm leading-relaxed">{line.text}</p>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {requirementGroups.length > 0 && (
            <section>
              <SectionTitle>Cerințe de calificare și tehnice</SectionTitle>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {requirementGroups.map((g) => (
                  <div key={g.key} className="neu-flat rounded-3xl bg-paper p-4">
                    <Eyebrow>{g.label}</Eyebrow>
                    <ul className="mt-1.5 space-y-1.5">
                      {g.items.map((item, i) => (
                        <li key={i} className="font-body text-sm leading-relaxed">
                          {item.text}
                          {item.quote && (
                            <span className="mt-0.5 block border-l-2 border-divider pl-2 text-xs italic text-stock-500">„{item.quote}”</span>
                          )}
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </section>
          )}

          {allFlags.length > 0 ? (
            <section>
              <SectionTitle note={`${selected.size} din ${allFlags.length} selectate`}>Clauze restrictive și capcane</SectionTitle>
              {allFlags.some((f) => f.legal_status_note) && (
                <p className="font-body mb-3 text-xs leading-relaxed text-stock-500">
                  {allFlags.find((f) => f.legal_status_note)?.legal_status_note}
                </p>
              )}
              <div className="divide-y divide-divider neu-flat overflow-hidden rounded-3xl bg-paper">
                {allFlags.map((flag, i) => {
                  const key = flagKey(flag, i);
                  const checked = selected.has(key);
                  const fromAi = (flag as { source?: string }).source === "ai";
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
                          <h3 className="font-display text-base font-semibold leading-snug first-letter:uppercase">{flag.pattern}</h3>
                          <span className="flex shrink-0 gap-1.5">
                            <Badge tone="neutral">{fromAi ? "AI" : "Verificare legală"}</Badge>
                            {flag.risk_classification === "POTENTIAL_RESTRICTIVE_SPECIFICATION_RISK" && (
                              <Badge tone="warning">Risc potențial</Badge>
                            )}
                            <Badge tone={SEVERITY_TONE[flag.severity] ?? "neutral"}>{flag.severity}</Badge>
                          </span>
                        </div>
                        {flag.excerpt && (
                          <p className="font-body mt-1.5 border-l-2 border-divider pl-3 text-sm italic text-stock-600">„{flag.excerpt}”</p>
                        )}
                        <p className="font-body mt-2 text-sm leading-relaxed text-stock-700">{flag.tactical_advisory}</p>
                        <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                          {flag.legal_citations?.length ? (
                            <p className="font-mono text-[11px] text-stock-500">Temei: {flag.legal_citations.join("; ")}</p>
                          ) : (
                            <span />
                          )}
                          <button
                            type="button"
                            onClick={() => forwardToDrafting([flag])}
                            className="font-sans text-xs font-semibold text-accent hover:brightness-110"
                          >
                            Clarificare art. 160 →
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
              <Button onClick={() => forwardToDrafting()} disabled={!selected.size} fullWidth className="mt-4">
                Generează solicitarea de clarificări (art. 160) cu {selected.size}{" "}
                {selected.size === 1 ? "clauză" : "clauze"}
              </Button>
            </section>
          ) : (
            !insightLoading && (
              <p className="font-body text-sm text-stock-600">
                {insight?.status === "ready"
                  ? "Nicio clauză restrictivă identificată — nici de verificarea legală, nici de analiza AI."
                  : "Nicio clauză restrictivă dintre tiparele verificate."}
              </p>
            )
          )}

          {/* When the NZIA flag is already in the list above, this says only
              what the bidder must prepare — not the finding a second time. */}
          {result.net_zero && (!nzFlagged || result.net_zero.applies) && (
            <section>
              <SectionTitle>{nzFlagged ? "Ce pregătiți pentru art. 25 NZIA" : "Tehnologii „zero net” — art. 25 NZIA"}</SectionTitle>
              <div className="neu-flat rounded-3xl bg-paper p-4">
                {!nzFlagged && (
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
                )}
                {result.net_zero.applies && (
                  <ul className={nzFlagged ? "space-y-1.5" : "mt-3 space-y-1.5"}>
                    {result.net_zero.bidder_obligations.map((o, i) => (
                      <li key={i} className="font-body text-sm leading-relaxed text-stock-700">
                        — {o}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </section>
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
  no_presumption: "border-positive/25 bg-positive-soft",
  near_threshold: "border-warning/25 bg-warning-soft",
  presumption: "border-negative/25 bg-negative-soft",
  over_budget: "border-negative/25 bg-negative-soft",
  not_applicable: "border-line-strong bg-surface-2",
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

  const qualityBased = criterion === "best_value" || criterion === "best_cost";
  const costBased = criterion === "best_cost" || criterion === "lowest_cost";

  const handleCalculate = async () => {
    if (budget <= 0 || price <= 0) {
      setError("Bugetul și prețul ofertat trebuie să fie valori pozitive.");
      return;
    }
    setLoading(true);
    setError(null);
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
          procedureType: tender.procedure_type,
        })
      );
    } catch (e) {
      setError(e instanceof ApiError ? e.detail : "Calculul nu a putut fi finalizat.");
    } finally {
      setLoading(false);
    }
  };

  const ratio = budget > 0 ? (price / budget) * 100 : 0;
  const strategy = result?.strategy;
  const risk = strategy?.abnormally_low_risk;
  const check = strategy?.criterion_check;
  const meta = result?.legal_regime;

  return (
    <Panel className="p-4 sm:p-6">
      <h2 className="font-display text-2xl font-bold leading-tight tracking-tight">Poziționare preț</h2>
      <Hint>
        Introduceți valoarea estimată, prețul pe care vreți să-l ofertați și criteriul din fișa de date — vedeți verdictul,
        garanțiile și cum vă situați față de un rival.
      </Hint>

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
        <div className="mt-8 space-y-7">
          {/* 1 — Verdict and the money the bid costs before any point is scored. */}
          <section className="neu-flat rounded-3xl bg-paper p-5 sm:p-6">
            <Eyebrow className="text-accent">Verdict</Eyebrow>
            <p className="font-display mt-1.5 text-3xl font-semibold leading-tight sm:text-4xl">{result.assessment}</p>
            <p className="font-mono mt-3 text-[11px] uppercase tracking-widest text-stock-500">
              {strategy.ratio_pct?.toFixed(2)}% din estimare · discount {result.discount_percentage}%
              {meta?.procedure_name ? ` · ${meta.procedure_name} · ${meta.applicable_law}` : ""}
            </p>
            {check && !check.allowed && <p className="font-body mt-3 text-sm font-medium text-negative">{check.issues.join(" ")}</p>}
            <p className="font-body mt-3 text-sm text-stock-600">
              {strategy.market_position
                ? `Față de câștigători: ${strategy.market_position.label.charAt(0).toLowerCase()}${strategy.market_position.label.slice(1)} — tipic ${formatRon(
                    strategy.market_position.reference_prices_ron.p25
                  )} – ${formatRon(strategy.market_position.reference_prices_ron.p75)}. Bază: ${strategy.market_position.sample_size} contracte atribuite în SEAP (${strategy.market_position.scope_label}), fără acorduri-cadru — un reper istoric, nu o probabilitate de câștig.`
                : "Fără reper de piață: prea puține atribuiri comparabile; verdictul se sprijină pe regulile legale."}
            </p>

            {strategy.guarantees && (
              <div className="mt-5 grid grid-cols-2 gap-3 border-t border-divider pt-5 sm:grid-cols-4" title={strategy.guarantees.basis}>
                {[
                  ["Garanție participare", `max ${formatRon(strategy.guarantees.participation_max_ron)}`, "≤ 1% din estimare"],
                  ["Garanție bună execuție", `max ${formatRon(strategy.guarantees.performance_max_ron)}`, "≤ 10% din prețul ofertat"],
                  risk?.code === "not_applicable"
                    ? ["Prag 80% · art. 136(4)", "nu se aplică", "achiziție directă"]
                    : ["Prag 80% · art. 136(4)", formatRon(risk?.threshold_ron), "sub el: prezumție"],
                  [
                    "Cauțiune CNSC 2%",
                    meta?.cautiune ? formatRon(meta.cautiune.pre_submission_ron) : "—",
                    meta?.cnsc_deadline_days ? `termen ${meta.cnsc_deadline_days} zile` : "achiziție directă: instanță",
                  ],
                ].map(([label, value, note]) => (
                  <div key={label}>
                    <Eyebrow>{label}</Eyebrow>
                    <p className="tabular font-display mt-1 text-lg font-semibold leading-none">{value}</p>
                    <p className="font-mono mt-1 text-[10px] text-stock-500">{note}</p>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* 2 — What a cheaper rival does to the score. */}
          {strategy.scenarios && (
            <section>
              <SectionTitle note={strategy.award_criterion_label}>Dacă un rival ofertează…</SectionTitle>
              <div className="scroll-x overflow-x-auto">
                <table className="w-full min-w-[34rem] neu-pressed overflow-hidden rounded-2xl bg-paper text-left font-mono text-xs">
                  <thead>
                    <tr className="border-b border-divider">
                      {["Rivalul la", "Prețul lui", qualityBased ? "Puncte preț (dvs. / el)" : "Rezultat", qualityBased ? "Punctaj tehnic necesar" : "Notă"].map((h) => (
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
                        <td className="px-3 py-2.5">{qualityBased ? `${s.your_price_points} / ${s.rival_price_points}` : s.outcome}</td>
                        <td className="px-3 py-2.5 text-accent">
                          {qualityBased ? s.outcome : s.note || "—"}
                          {qualityBased && s.note && <span className="block text-stock-500">{s.note}</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {qualityBased && (
                <p className="mt-2 flex items-center gap-1.5 text-[13px] text-stock-500">
                  <span className="tabular">
                    Ponderi: preț {strategy.price_weight_pct ?? priceWeight}% · tehnic {strategy.technical_weight_pct ?? 100 - priceWeight}%
                  </span>
                  <Explainer title="Cum se calculează">
                    {strategy.scoring_model?.formula && <span className="tabular block text-ink">{strategy.scoring_model.formula}</span>}
                    <span className="mt-2 block">
                      Oferta cu prețul cel mai mic primește toate punctele de preț; celelalte primesc proporțional (prețul cel mai mic ÷ prețul ofertei × punctajul financiar maxim), plus punctajul tehnic acordat de comisie.
                    </span>
                    {strategy.scenarios?.[0] && (
                      <span className="mt-2 block">
                        Exemplu: rivalul ofertează {formatRon(strategy.scenarios[0].rival_price_ron)} ({strategy.scenarios[0].rival_ratio_pct}% din estimare) → puncte la preț: dvs. {strategy.scenarios[0].your_price_points}, el {strategy.scenarios[0].rival_price_points}.
                      </span>
                    )}
                    <span className="mt-2 block">Ponderile reale sunt cele din fișa de date a procedurii; aici sunt cele introduse de dvs.</span>
                  </Explainer>
                </p>
              )}
            </section>
          )}

          {strategy.lifecycle && (
            <section>
              <SectionTitle note={strategy.lifecycle.discount_rate ? `rata ${strategy.lifecycle.discount_rate.rate_pct}%` : undefined}>
                Costul pe ciclul de viață
              </SectionTitle>
              {strategy.lifecycle.lifecycle_cost_ron != null ? (
                <p className="font-body text-sm">
                  Preț {formatRon(price)} + costuri actualizate {formatRon(strategy.lifecycle.present_value_operating_ron)} ={" "}
                  <span className="tabular font-semibold">{formatRon(strategy.lifecycle.lifecycle_cost_ron)}</span>
                </p>
              ) : (
                <p className="font-body text-sm text-stock-600">
                  {strategy.lifecycle.note || "Introduceți costul anual și durata pentru a calcula costul pe ciclul de viață."}
                </p>
              )}
              {strategy.lifecycle.discount_rate && (
                <p className="font-mono mt-2 flex items-center gap-1.5 text-[11px] text-stock-500" title={strategy.lifecycle.methodology_note || undefined}>
                  Metodologie: rată {String(strategy.lifecycle.discount_rate.rate_pct).replace(".", ",")}% · Ord. ANAP nr. 12/2026 · doar cost ciclu de viață, nu discount
                  <Explain k="lccDiscountRate" />
                </p>
              )}
            </section>
          )}

          {/* 3 — The legal position, once, with the way out when it bites. */}
          {risk && (
            <section className={"rounded-xl border p-5 sm:p-6 " + (RISK_BORDER[risk.code] ?? "border-divider bg-paper")}>
              <span className="flex items-center gap-1.5">
                <Eyebrow className={risk.code === "no_presumption" ? "text-positive" : risk.code === "not_applicable" ? "text-stock-600" : risk.code === "near_threshold" ? "text-warning" : "text-negative"}>
                  {risk.level} · art. {meta?.regime === "L99" ? "222" : "210"} / art. 136 alin. (1) și (4)
                </Eyebrow>
                <Explain k="abnormallyLowPrice" />
              </span>
              <p className="font-body mt-2 text-sm leading-relaxed">{risk.detail}</p>
              {risk.requires_justification_dossier && (
                <Button
                  className="mt-4"
                  fullWidth
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
                  Generează Justificare Preț Art. {meta?.regime === "L99" ? "222" : "210"} în Redactare →
                </Button>
              )}

              <details className="group mt-4 border-t border-divider pt-3">
                <summary className="flex cursor-pointer list-none items-center justify-between font-sans text-xs font-semibold text-stock-600 hover:text-ink">
                  Temei legal (Art. {meta?.regime === "L99" ? "222" : "210"} & Art. 136)
                  <ChevronDown size={15} className="transition-transform group-open:rotate-180" />
                </summary>
                <div className="mt-3 space-y-4">
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <div>
                      <Eyebrow className={risk.presumption_triggered ? "text-negative" : "text-stock-500"}>
                        Calea 1 · prezumția sub 80% {risk.presumption_triggered ? "— se aplică" : "— nu se aplică"}
                      </Eyebrow>
                      <p className="font-body mt-1 text-xs leading-relaxed text-stock-600">{risk.track1}</p>
                      <p className="font-mono mt-1 text-[10px] text-stock-500">{risk.presumption_basis}</p>
                    </div>
                    <div>
                      <Eyebrow className="text-warning">Calea 2 · elementele de preț — se aplică mereu</Eyebrow>
                      <p className="font-body mt-1 text-xs leading-relaxed text-stock-600">{risk.track2}</p>
                      <p className="font-mono mt-1 text-[10px] text-stock-500">{risk.element_audit_basis}</p>
                    </div>
                  </div>
                  <div>
                    <Eyebrow>Verificarea pe elemente înainte de depunere</Eyebrow>
                    <ol className="mt-1 divide-y divide-divider">
                      {risk.element_audit.map((e) => (
                        <li key={e.key} className="py-2">
                          <p className="font-body text-sm font-semibold">{e.label}</p>
                          <p className="font-body mt-0.5 text-xs leading-relaxed text-stock-600">{e.check}</p>
                          <p className="font-mono mt-0.5 text-[10px] text-stock-500">
                            Dovezi: {e.evidence} · {e.basis}
                          </p>
                        </li>
                      ))}
                    </ol>
                  </div>
                  {risk.legal_basis?.length > 0 && (
                    <div className="space-y-2">
                      <Eyebrow>Textul articolelor</Eyebrow>
                      {risk.legal_basis.map((a) => (
                        <div key={a.citation}>
                          <p className="font-mono text-[11px] font-semibold text-accent">{a.citation}</p>
                          <p className="font-body mt-1 text-xs leading-relaxed text-stock-600">„{a.text}”</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </details>
            </section>
          )}
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
  const requested = searchParams.get("tool");
  const [activeTool, setActiveTool] = useState<ToolId>(
    TOOLS.find((t) => t.id === requested)?.id ?? "competitor"
  );
  const { ask } = useCopilot();
  const router = useRouter();
  // Old links and bookmarks to the copilot tab open the floating copilot.
  useEffect(() => {
    if (requested === "copilot") ask();
  }, [requested, ask]);
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
  const preSeap = lead?.record_kind === "PRE_TENDER_SIGNAL";
  // Re-mount the tools once the record arrives so their inputs start from
  // the tender rather than from the fallback URL parameters.
  const toolKey = `${tender.source_id ?? "none"}-${leadState}`;
  useActiveTender(tender.source_id, tender.project_title || null);

  return (
    <main className="mx-auto w-full max-w-[1264px] flex-1 px-5 pb-16 pt-8 sm:px-8 sm:pt-12">
      <PageHeader eyebrow="Instrumente" title="Strategie" standfirst="Profilul pieței, citirea caietului de sarcini și verificarea prețului față de pragul de 80% — înainte de depunere." />

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
          <TenderBanner tender={tender} />
          {preSeap && (activeTool === "competitor" || activeTool === "win") ? (
            // A permit or a council decision has no contract estimate and no
            // offer to position: the 80% threshold, the cauțiune and the
            // guarantees start with the procedure, not before it.
            <Panel>
              <Notice tone="neutral" title="Semnal pre-SEAP — instrumentele de preț nu se aplică încă">
                {lead?.pre_seap?.not_applicable ??
                  "Nu există încă o procedură de atribuire, deci nici prag de 80%, cauțiune CNSC sau garanții."}
              </Notice>
              <div className="mt-4">
                <Button
                  onClick={() =>
                    router.push(foiaHref(lead?.source_id, lead?.pre_seap?.foia_presets ?? PRE_SEAP_FOIA_PRESETS))
                  }
                >
                  Cerere informații interes public — Legea 544/2001
                </Button>
              </div>
            </Panel>
          ) : (
            <>
              {activeTool === "competitor" && <CompetitorTool key={toolKey} tender={tender} />}
              {activeTool === "caiet" && <CaietTool key={toolKey} tender={tender} artifactId={searchParams.get("artifact")} />}
              {activeTool === "win" && <WinOddsTool key={toolKey} tender={tender} />}
            </>
          )}
        </>
      )}
    </main>
  );
}

export default function AnalyticsPage() {
  return (
    <AuthGate
      title="Strategie"
      description="Profilul de piață, scannerul de caiet și poziționarea prețului (art. 210)."
    >
      <Suspense
        fallback={
          <main className="mx-auto w-full max-w-[1264px] flex-1 px-5 pb-16 pt-8 sm:px-8 sm:pt-12">
            <Loading />
          </main>
        }
      >
        <AnalyticsContent />
      </Suspense>
    </AuthGate>
  );
}
