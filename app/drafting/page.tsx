"use client";
import { Suspense, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import AuthGate from "@/components/AuthGate";
import Explain from "@/components/Explain";
import DocumentPreviewPanel from "@/components/DocumentPreviewPanel";
import {
  ApiError,
  exportClarificationDocx,
  exportDossierDocx,
  fetchLegalRegime,
  fetchOpportunitiesPage,
  fetchOpportunity,
  generateLegalClarification,
  generateTechnicalProposal,
  verifyCompany,
  type AuthorityLevel,
  type BidderIdentity,
  type ClarificationRequest,
  type ClarificationResult,
  type ContractType,
  type DeclarationId,
  type LegalMetadata,
  type LegalRegime,
  type LetterType,
  type TechnicalProposalRequest,
  type TechnicalProposalResult,
} from "@/lib/api";
import { CATEGORIES, formatNumber, formatRon } from "@/lib/format";
import {
  Badge,
  Button,
  Checkbox,
  Eyebrow,
  Field,
  Input,
  Notice,
  NumberInput,
  PageHeader,
  Panel,
  Select,
  TabBar,
  Textarea,
  Loading,
} from "@/components/newsprint";

const TOOLS = [
  { id: "proposal", label: "Propunere tehnică" },
  { id: "clarification", label: "Clarificări & corespondență" },
] as const;

type ToolId = (typeof TOOLS)[number]["id"];

// Same compact-field and accent-button conventions as /eligibility, so the
// two tool pages read as one product.
const COMPACT_FIELD = "min-h-9 py-1.5";
const ACTION_BUTTON = "bg-[#006494] text-white hover:text-white";

const BIDDER_STORAGE_KEY = "ro_intel_drafting_bidder";

const CONTRACT_TYPES: { id: ContractType; label: string }[] = [
  { id: "lucrari", label: "Lucrări" },
  { id: "servicii", label: "Servicii" },
  { id: "produse", label: "Produse" },
];

const DECLARATIONS: { id: DeclarationId; label: string }[] = [
  { id: "env_social", label: "Mediu, social & muncă (art. 51)" },
  { id: "conflict_of_interest", label: "Conflict de interese (art. 59-60)" },
  { id: "confidentiality", label: "Confidențialitate + justificare (art. 57)" },
  { id: "exclusion", label: "Neîncadrare în excludere (art. 164-167)" },
];

const LETTERS: { id: LetterType; title: string; stage: string; pointsLabel: string; placeholder: string }[] = [
  {
    id: "clarification",
    title: "Clarificări & remediere",
    stage: "Înainte de depunere",
    pointsLabel: "Clauze contestate / întrebări",
    placeholder: "1. Cerința de experiență similară (3 contracte) este disproporționată față de valoarea contractului.\n2. Specificația impune marca X fără mențiunea „sau echivalent”.",
  },
  {
    id: "evaluation_response",
    title: "Răspuns comisie",
    stage: "În evaluare",
    pointsLabel: "Răspunsurile la întrebările comisiei",
    placeholder: "1. Referitor la fișa tehnică a echipamentului X: modelul ofertat este cel din anexa 3, pag. 14; denumirea din formular conținea o eroare de redactare.",
  },
  {
    id: "abnormally_low_price",
    title: "Justificare preț",
    stage: "În evaluare",
    pointsLabel: "Soluții tehnice și condiții favorabile",
    placeholder: "Ex.: stoc propriu de materiale achiziționat anterior creșterii prețurilor; utilaje proprii amortizate; bază de producție la 8 km de amplasament.",
  },
  {
    id: "dossier_access",
    title: "Acces la dosar",
    stage: "După rezultat",
    pointsLabel: "Documente solicitate (opțional)",
    placeholder: "Lăsat gol: raportul procedurii, propunerea tehnică și justificările de preț ale câștigătorului nedeclarate confidențiale, declarațiile de confidențialitate.",
  },
  {
    id: "foia",
    title: "Informații publice",
    stage: "Legea 544/2001",
    pointsLabel: "Alte informații solicitate",
    placeholder: "Ex.: devizul general aprobat pentru obiectivul de investiții.",
  },
];

const FOIA_PRESETS = [
  { id: "paap", label: "PAAP" },
  { id: "studiu_fezabilitate", label: "SF / DALI" },
  { id: "rapoarte_atribuire", label: "Rapoarte de atribuire" },
  { id: "contracte_anterioare", label: "Contracte anterioare" },
];

const PRICE_COMPONENTS = [
  { id: "labor", label: "Manoperă" },
  { id: "materials", label: "Materiale" },
  { id: "equipment_logistics", label: "Utilaje & logistică" },
  { id: "overhead", label: "Cheltuieli indirecte" },
  { id: "profit", label: "Profit" },
] as const;

interface ProcedureForm {
  project_title: string;
  authority_name: string;
  county: string;
  category: string;
  estimated_value_ron: number;
  contract_type: ContractType | "";
  cpv_code: string;
  source_id: string;
  regime: LegalRegime | "";
  authority_level: AuthorityLevel | "";
}

/**
 * CPV division → contract type. Division 45 is construction work; 03-44
 * and 48 are supplies; 50 and above are services (Regulation (EC) No
 * 213/2008). Only a starting point — the user can still change it.
 */
function contractTypeFromCpv(cpv?: string | null): ContractType | "" {
  const division = Number((cpv || "").replace(/\D/g, "").slice(0, 2));
  if (!division) return "";
  if (division === 45) return "lucrari";
  if (division >= 50) return "servicii";
  return "produse";
}

function readStoredBidder(): BidderIdentity | null {
  try {
    const raw = window.localStorage.getItem(BIDDER_STORAGE_KEY);
    return raw ? (JSON.parse(raw) as BidderIdentity) : null;
  } catch {
    return null;
  }
}

function storeBidder(bidder: BidderIdentity) {
  try {
    window.localStorage.setItem(BIDDER_STORAGE_KEY, JSON.stringify(bidder));
  } catch {
    // Private mode / blocked storage: the form still works, it just won't
    // remember the company next time.
  }
}

/* ------------------------------------------------------------ tender pick */

type PickResult = { source_id?: string; project_title: string; entity_name: string; county: string; financial_value_ron: number };

function TenderPicker({ onPick, loadingId }: { onPick: (sourceId: string | undefined, fallback?: PickResult) => void; loadingId: boolean }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<PickResult[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSearch = async () => {
    const q = query.trim();
    if (!q) return;
    setError(null);
    setResults(null);
    // A notice id has no spaces; anything else is a keyword search.
    if (!/\s/.test(q)) {
      onPick(q);
      return;
    }
    setSearching(true);
    try {
      const page = await fetchOpportunitiesPage({ keywords: [q] }, 1, 6);
      setResults(page.items);
      if (!page.items.length) setError("Nicio licitație găsită pentru acest termen.");
    } catch (e) {
      setError(e instanceof ApiError ? e.detail : "Căutarea a eșuat.");
    } finally {
      setSearching(false);
    }
  };

  return (
    <div>
      <div className="flex gap-2">
        <Input
          className={COMPACT_FIELD}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSearch()}
          placeholder="ID anunț (ex. SCN1234567) sau cuvinte-cheie din titlu"
          aria-label="Preia date din licitație"
        />
        <Button variant="outline" className="min-h-9 shrink-0 py-1.5" onClick={handleSearch} disabled={searching || loadingId}>
          {searching || loadingId ? "Se caută…" : "Preia date"}
        </Button>
      </div>
      {error && <p className="font-body mt-1.5 text-xs text-negative">{error}</p>}
      {results && results.length > 0 && (
        <ul className="neu-pressed mt-2 divide-y divide-divider overflow-hidden rounded-2xl bg-paper">
          {results.map((r) => (
            <li key={r.source_id || r.project_title}>
              <button
                type="button"
                onClick={() => {
                  setResults(null);
                  onPick(r.source_id, r);
                }}
                className="w-full px-3 py-2 text-left transition-colors hover:bg-editorial-soft"
              >
                <span className="font-display block text-sm font-semibold leading-snug">{r.project_title}</span>
                <span className="font-mono block text-[11px] text-stock-500">
                  {r.entity_name} · {r.county} · {formatRon(r.financial_value_ron)}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/* ------------------------------------------------------- regime strip */

function LegalRegimeStrip({
  meta,
  loading,
  form,
  setForm,
}: {
  meta: LegalMetadata | null;
  loading: boolean;
  form: ProcedureForm;
  setForm: (f: ProcedureForm) => void;
}) {
  if (!form.estimated_value_ron || !form.contract_type) {
    return (
      <p className="font-body mt-4 text-xs text-stock-500">
        Completați valoarea estimată și tipul contractului pentru regimul legal, termenul de contestare și cauțiune.
      </p>
    );
  }
  return (
    <div className="neu-pressed mt-4 rounded-2xl bg-paper px-4 py-3" aria-live="polite">
      <div className="flex items-center justify-between gap-2">
        <Eyebrow className="flex items-center gap-1.5">
          Regim legal <Explain k="legalRegime" />
        </Eyebrow>
        {loading && <span className="font-mono text-[10px] text-stock-500">se calculează…</span>}
      </div>
      {meta && (
        <>
          <dl className="mt-2 grid grid-cols-1 gap-x-6 gap-y-2 sm:grid-cols-3">
            <div>
              <dt className="font-sans text-[10px] font-semibold uppercase tracking-widest text-stock-500">Regim & procedură</dt>
              <dd className="font-display text-sm font-semibold leading-snug">
                {meta.applicable_law}
                {meta.regime === "L99" && " (sectorial)"} · {meta.procedure_name}
              </dd>
              <dd className="font-mono text-[10px] text-stock-500">{meta.procedure_basis}</dd>
            </div>
            <div>
              <dt className="font-sans text-[10px] font-semibold uppercase tracking-widest text-stock-500">Termen contestație CNSC</dt>
              <dd className="font-display text-sm font-semibold">{meta.cnsc_deadline_days} zile</dd>
              <dd className="font-mono text-[10px] text-stock-500">{meta.cnsc_deadline_basis.replace("din Legea nr. 101/2016", "L101/2016")}</dd>
            </div>
            <div>
              <dt className="font-sans text-[10px] font-semibold uppercase tracking-widest text-stock-500">Cauțiune CNSC (art. 61¹)</dt>
              {meta.cautiune ? (
                <>
                  <dd className="font-display text-sm font-semibold tabular">{formatNumber(meta.cautiune.pre_submission_ron)} lei</dd>
                  <dd className="font-mono text-[10px] text-stock-500">
                    înainte de depunere · după: {formatNumber(meta.cautiune.post_submission_ron)} lei
                  </dd>
                </>
              ) : (
                <dd className="font-body text-sm text-stock-500">—</dd>
              )}
            </div>
          </dl>
          <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-divider pt-2.5">
            <Select
              className="min-h-8 w-auto py-1 text-xs"
              value={form.regime}
              onChange={(e) => setForm({ ...form, regime: e.target.value as LegalRegime | "" })}
              aria-label="Regim juridic"
            >
              <option value="">Regim: automat ({meta.regime === "L99" ? "sectorial" : "clasic"})</option>
              <option value="L98">Legea 98/2016 + HG 395/2016 — clasic</option>
              <option value="L99">Legea 99/2016 + HG 394/2016 — sectorial</option>
            </Select>
            {meta.regime === "L98" && form.contract_type !== "lucrari" && (
              <Select
                className="min-h-8 w-auto py-1 text-xs"
                value={form.authority_level}
                onChange={(e) => setForm({ ...form, authority_level: e.target.value as AuthorityLevel | "" })}
                aria-label="Tipul autorității"
              >
                <option value="">Autoritate: automat ({meta.authority_level === "local" ? "locală" : "centrală"})</option>
                <option value="central">Autoritate centrală</option>
                <option value="local">Autoritate locală (CJ, CL, subordonate)</option>
              </Select>
            )}
            <span className="font-mono text-[10px] text-stock-500">
              Prag UE {formatNumber(meta.thresholds.eu_ron)} lei · în vigoare din{" "}
              {meta.thresholds.effective_from.split("-").reverse().join(".")}
            </span>
          </div>
          {meta.warnings.map((w) => (
            <p key={w} className="font-body mt-2 text-xs leading-relaxed text-warning">
              {w}
            </p>
          ))}
        </>
      )}
    </div>
  );
}

/* ------------------------------------------------------------- bidder */

function BidderCard({ bidder, setBidder }: { bidder: BidderIdentity; setBidder: (b: BidderIdentity) => void }) {
  const [open, setOpen] = useState(!bidder.company_name || !bidder.legal_representative);
  const [verifying, setVerifying] = useState(false);
  const [lookup, setLookup] = useState<{ ok: boolean; text: string } | null>(null);
  // Same guard as /eligibility: a blur on an unchanged CUI must not re-hit ANAF.
  const lastLookedUpCuiRef = useRef<string>("");

  const handleCuiBlur = async () => {
    const cui = (bidder.cui || "").trim();
    if (!cui || cui === lastLookedUpCuiRef.current || verifying) return;
    lastLookedUpCuiRef.current = cui;
    setVerifying(true);
    setLookup(null);
    try {
      const found = await verifyCompany(cui);
      if (found.verified && found.company) {
        const c = found.company;
        // The register is authoritative, so it overwrites — the same rule
        // /eligibility applies. The representative is not in ANAF's data
        // and is left as typed.
        setBidder({
          ...bidder,
          cui,
          company_name: c.company_name || bidder.company_name,
          trade_register_no: c.trade_registry_number || bidder.trade_register_no,
          headquarters: c.address || [c.locality, c.county].filter(Boolean).join(", ") || bidder.headquarters,
        });
        setLookup({ ok: true, text: c.is_inactive_taxpayer ? "Verificat ANAF — inactiv fiscal (motiv de excludere)" : "Verificat ANAF" });
      } else {
        setLookup({ ok: false, text: found.error || "ANAF nu a returnat nicio firmă pentru acest CUI." });
      }
    } catch (e) {
      setLookup({ ok: false, text: e instanceof ApiError ? e.detail : "Căutarea în registre a eșuat." });
    } finally {
      setVerifying(false);
    }
  };

  const set = (key: keyof BidderIdentity) => (e: React.ChangeEvent<HTMLInputElement>) => setBidder({ ...bidder, [key]: e.target.value });

  return (
    <Panel className="p-4 sm:p-5">
      <button type="button" onClick={() => setOpen(!open)} aria-expanded={open} className="flex w-full items-center justify-between gap-3 text-left">
        <div className="min-w-0">
          <Eyebrow>Date ofertant (Subscrisa)</Eyebrow>
          <p className="font-display mt-1 truncate text-sm font-semibold">
            {bidder.company_name || "Completați datele firmei"}
            {bidder.cui && <span className="font-mono ml-2 text-[11px] font-normal text-stock-500">CUI {bidder.cui}</span>}
          </p>
        </div>
        <span className="font-mono shrink-0 text-[11px] text-editorial">{open ? "Restrânge" : "Editează"}</span>
      </button>
      {open && (
        <div className="mt-4 grid grid-cols-1 gap-4 border-t border-divider pt-4 sm:grid-cols-2 lg:grid-cols-3">
          <Field label="CUI / cod fiscal" hint="La ieșirea din câmp, datele se preiau din ANAF.">
            <Input className={COMPACT_FIELD} value={bidder.cui || ""} onChange={set("cui")} onBlur={handleCuiBlur} placeholder="RO12345678" />
          </Field>
          <Field label="Denumire societate">
            <Input className={COMPACT_FIELD} value={bidder.company_name || ""} onChange={set("company_name")} autoComplete="organization" />
          </Field>
          <Field label="Nr. Reg. Com.">
            <Input className={COMPACT_FIELD} value={bidder.trade_register_no || ""} onChange={set("trade_register_no")} placeholder="J12/345/2015" />
          </Field>
          <Field label="Sediu social" className="sm:col-span-2 lg:col-span-1">
            <Input className={COMPACT_FIELD} value={bidder.headquarters || ""} onChange={set("headquarters")} />
          </Field>
          <Field label="Reprezentant legal">
            <Input className={COMPACT_FIELD} value={bidder.legal_representative || ""} onChange={set("legal_representative")} placeholder="Nume și prenume" />
          </Field>
          <Field label="Calitate">
            <Input className={COMPACT_FIELD} value={bidder.representative_role || ""} onChange={set("representative_role")} placeholder="administrator" />
          </Field>
          {(verifying || lookup) && (
            <div className="sm:col-span-2 lg:col-span-3">
              {verifying ? (
                <span className="font-mono text-[11px] text-stock-500">Se caută în registrele ANAF…</span>
              ) : (
                lookup && <Badge tone={lookup.ok ? "positive" : "negative"}>{lookup.text}</Badge>
              )}
            </div>
          )}
        </div>
      )}
    </Panel>
  );
}

/* ------------------------------------------------------------ proposal */

function parseDecisionMakers(text: string) {
  return text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [name, ...role] = line.split(/\s+[—–-]\s+|,\s*/);
      return { name: name.trim(), role: role.join(", ").trim() || undefined };
    });
}

function ProposalTool({
  buildBase,
  onPreview,
}: {
  buildBase: () => Omit<TechnicalProposalRequest, "include_declarations">;
  onPreview: (result: TechnicalProposalResult, payload: TechnicalProposalRequest) => void;
}) {
  const [declarations, setDeclarations] = useState<DeclarationId[]>(DECLARATIONS.map((d) => d.id));
  const [decisionMakers, setDecisionMakers] = useState("");
  const [requirements, setRequirements] = useState("");
  const [aiMode, setAiMode] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const toggle = (id: DeclarationId) =>
    setDeclarations((prev) => (prev.includes(id) ? prev.filter((d) => d !== id) : [...prev, id]));

  const handleGenerate = async () => {
    const base = buildBase();
    if (!base.project_title.trim() || !base.authority_name.trim()) {
      setError("Titlul proiectului și autoritatea contractantă sunt obligatorii.");
      return;
    }
    const payload: TechnicalProposalRequest = {
      ...base,
      include_declarations: declarations,
      decision_makers: declarations.includes("conflict_of_interest") ? parseDecisionMakers(decisionMakers) : [],
      cerinte_caiet: requirements.trim() || undefined,
      use_ai_expansion: aiMode,
    };
    setLoading(true);
    setError(null);
    try {
      onPreview(await generateTechnicalProposal(payload), payload);
    } catch (e) {
      setError(e instanceof ApiError ? e.detail : "Generarea propunerii a eșuat.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Panel className="p-4 sm:p-5">
      <Eyebrow className="mb-4 border-b border-divider pb-2">Propunere tehnică · declarații · matrice de conformitate</Eyebrow>

      <div className="grid grid-cols-1 gap-x-4 sm:grid-cols-2">
        {DECLARATIONS.map((d) => (
          <Checkbox key={d.id} label={d.label} checked={declarations.includes(d.id)} onChange={() => toggle(d.id)} className="min-h-9" />
        ))}
      </div>
      {declarations.includes("conflict_of_interest") && (
        <div className="mt-3">
          <Field label="Persoane cu funcții de decizie" hint="Din fișa de date — una pe rând: Nume — Funcție. Lăsat gol, tabelul rămâne de completat.">
            <Textarea className="min-h-[4.5rem] py-2" value={decisionMakers} onChange={(e) => setDecisionMakers(e.target.value)} placeholder={"Maria Ionescu — Primar\nAndrei Pop — Președinte comisie de evaluare"} />
          </Field>
        </div>
      )}

      <details className="mt-4 border-t border-divider pt-3" open={requirements.length > 0}>
        <summary className="font-display cursor-pointer text-sm font-semibold">Cerințe specifice din caietul de sarcini / fișa de date</summary>
        <div className="mt-3">
          <Textarea
            className="min-h-[8rem]"
            value={requirements}
            onChange={(e) => setRequirements(e.target.value)}
            placeholder="Lipiți cerințele, câte una pe rând — fiecare devine un rând în tabelul de corespondență. Lăsat gol, se folosește caietul extras automat pentru anunțul selectat, dacă există."
          />
        </div>
      </details>

      <div className="mt-4 flex flex-col gap-3 border-t border-divider pt-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="neu-pressed-sm inline-flex rounded-2xl bg-paper p-1" role="group" aria-label="Mod de generare">
          {[
            { on: false, label: "Rapid · determinist" },
            { on: true, label: "Extins cu AI" },
          ].map((opt) => (
            <button
              key={opt.label}
              type="button"
              onClick={() => setAiMode(opt.on)}
              aria-pressed={aiMode === opt.on}
              className={
                "min-h-9 rounded-xl px-3 font-body text-xs transition-all duration-300 " +
                (aiMode === opt.on ? "neu-flat-sm bg-paper font-semibold text-ink" : "text-stock-500 hover:text-ink")
              }
            >
              {opt.label}
            </button>
          ))}
        </div>
        <Button className={ACTION_BUTTON} onClick={handleGenerate} disabled={loading}>
          {loading ? "Se redactează…" : "Previzualizează propunerea"}
        </Button>
      </div>
      {aiMode && (
        <p className="font-body mt-2 text-xs leading-relaxed text-stock-500">
          Extinde metodologia și riscurile și redactează „modul de îndeplinire” pentru fiecare cerință din caiet. Adaugă câteva
          secunde; fără furnizor AI configurat, documentul rămâne cel determinist.
        </p>
      )}
      {error && (
        <div className="mt-4">
          <Notice tone="alert">{error}</Notice>
        </div>
      )}
      {loading && (
        <div className="mt-4">
          <Loading label="Se redactează documentul" />
        </div>
      )}
    </Panel>
  );
}

/* ------------------------------------------------------------- letters */

function LetterTool({
  initialType,
  buildBase,
  onPreview,
}: {
  initialType: LetterType;
  buildBase: () => Omit<ClarificationRequest, "clarification_points" | "request_type">;
  onPreview: (result: ClarificationResult, payload: ClarificationRequest) => void;
}) {
  const [type, setType] = useState<LetterType>(initialType);
  const [points, setPoints] = useState("");
  const [deadline, setDeadline] = useState("");
  const [evalRef, setEvalRef] = useState("");
  const [resultDate, setResultDate] = useState("");
  const [offeredPrice, setOfferedPrice] = useState(0);
  const [breakdown, setBreakdown] = useState<Record<string, number>>({});
  const [presets, setPresets] = useState<string[]>(["paap"]);
  const [useAi, setUseAi] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const spec = LETTERS.find((l) => l.id === type)!;
  const breakdownTotal = Object.values(breakdown).reduce((a, b) => a + (b || 0), 0);

  const handleGenerate = async () => {
    const base = buildBase();
    if (!base.authority_name.trim()) {
      setError("Autoritatea contractantă este obligatorie.");
      return;
    }
    if ((type === "clarification" || type === "evaluation_response") && !points.trim()) {
      setError("Completați punctele pe care le conține adresa.");
      return;
    }
    const payload: ClarificationRequest = {
      ...base,
      request_type: type,
      clarification_points: points,
      procedure_deadline: type === "clarification" ? deadline || undefined : undefined,
      evaluation_request_ref: type === "evaluation_response" || type === "abnormally_low_price" ? evalRef || undefined : undefined,
      result_communication_date: type === "dossier_access" ? resultDate || undefined : undefined,
      offered_price_ron: type === "abnormally_low_price" ? offeredPrice || undefined : undefined,
      price_breakdown: type === "abnormally_low_price" ? breakdown : undefined,
      foia_presets: type === "foia" ? presets : [],
      use_ai_expansion: useAi,
    };
    setLoading(true);
    setError(null);
    try {
      onPreview(await generateLegalClarification(payload), payload);
    } catch (e) {
      setError(e instanceof ApiError ? e.detail : "Generarea adresei a eșuat.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Panel className="p-4 sm:p-5">
      <Eyebrow className="mb-4 border-b border-divider pb-2">Instrument — după etapa procedurii</Eyebrow>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
        {LETTERS.map((opt) => (
          <button
            key={opt.id}
            type="button"
            onClick={() => setType(opt.id)}
            aria-pressed={type === opt.id}
            className={
              "rounded-2xl bg-paper px-3 py-2.5 text-left transition-all duration-300 " +
              (type === opt.id ? "neu-pressed border-l-[3px] border-editorial bg-editorial-soft" : "neu-flat-sm hover:neu-flat")
            }
          >
            <span className="font-display block text-sm font-semibold leading-snug">{opt.title}</span>
            <span className="font-mono block text-[10px] uppercase tracking-wider text-stock-500">{opt.stage}</span>
          </button>
        ))}
      </div>

      <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2">
        {type === "clarification" && (
          <Field label="Termen-limită depunere oferte" hint="Calculează data până la care autoritatea trebuie să răspundă.">
            <Input className={COMPACT_FIELD} type="date" value={deadline} onChange={(e) => setDeadline(e.target.value)} />
          </Field>
        )}
        {(type === "evaluation_response" || type === "abnormally_low_price") && (
          <Field label="Solicitarea comisiei" hint="Număr și dată, ex. nr. 123/15.10.2026.">
            <Input className={COMPACT_FIELD} value={evalRef} onChange={(e) => setEvalRef(e.target.value)} />
          </Field>
        )}
        {type === "abnormally_low_price" && (
          <Field label="Preț ofertat (lei, fără TVA)">
            <NumberInput className={COMPACT_FIELD} min={0} value={offeredPrice} onValueChange={setOfferedPrice} />
          </Field>
        )}
        {type === "dossier_access" && (
          <Field label="Data comunicării rezultatului" hint="Calculează ultima zi de contestare (art. 5 și 8 L101/2016).">
            <Input className={COMPACT_FIELD} type="date" value={resultDate} onChange={(e) => setResultDate(e.target.value)} />
          </Field>
        )}
      </div>

      {type === "abnormally_low_price" && (
        <div className="mt-4">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
            {PRICE_COMPONENTS.map((c) => (
              <Field key={c.id} label={c.label}>
                <NumberInput
                  className={COMPACT_FIELD}
                  min={0}
                  value={breakdown[c.id] || 0}
                  onValueChange={(v) => setBreakdown({ ...breakdown, [c.id]: v })}
                />
              </Field>
            ))}
          </div>
          <p className={"font-mono mt-1.5 text-[11px] " + (offeredPrice && breakdownTotal && Math.abs(breakdownTotal - offeredPrice) > 1 ? "text-warning" : "text-stock-500")}>
            Total componente: {formatNumber(breakdownTotal)} lei
            {offeredPrice > 0 && breakdownTotal > 0 && Math.abs(breakdownTotal - offeredPrice) > 1 && " — nu se reconciliază cu prețul ofertat"}
          </p>
        </div>
      )}

      {type === "foia" && (
        <div className="mt-4 flex flex-wrap gap-1.5">
          {FOIA_PRESETS.map((p) => {
            const active = presets.includes(p.id);
            return (
              <button
                key={p.id}
                type="button"
                aria-pressed={active}
                onClick={() => setPresets(active ? presets.filter((x) => x !== p.id) : [...presets, p.id])}
                className={
                  "min-h-[36px] rounded-xl px-3 py-1.5 font-body text-[13px] transition-all duration-300 " +
                  (active ? "neu-pressed-sm bg-editorial-soft font-medium text-editorial" : "neu-flat-sm bg-paper text-stock-600 hover:neu-lift")
                }
              >
                {p.label}
              </button>
            );
          })}
        </div>
      )}

      <div className="mt-4">
        <Field label={spec.pointsLabel}>
          <Textarea value={points} onChange={(e) => setPoints(e.target.value)} className="min-h-[7rem]" placeholder={spec.placeholder} />
        </Field>
      </div>

      <div className="mt-3 flex flex-col gap-3 border-t border-divider pt-3 sm:flex-row sm:items-center sm:justify-between">
        <Checkbox label="Adaugă fundamentare redactată cu AI" checked={useAi} onChange={(e) => setUseAi(e.target.checked)} className="min-h-9" />
        <Button className={ACTION_BUTTON} onClick={handleGenerate} disabled={loading}>
          {loading ? "Se redactează…" : "Previzualizează adresa"}
        </Button>
      </div>
      {error && (
        <div className="mt-4">
          <Notice tone="alert">{error}</Notice>
        </div>
      )}
      {loading && (
        <div className="mt-4">
          <Loading label="Se redactează documentul" />
        </div>
      )}
    </Panel>
  );
}

/* ------------------------------------------------------------------ shell */

type Preview =
  | { kind: "proposal"; result: TechnicalProposalResult; payload: TechnicalProposalRequest }
  | { kind: "letter"; result: ClarificationResult; payload: ClarificationRequest };

function DraftingContent() {
  const { profile, user } = useAuth();
  const searchParams = useSearchParams();
  const requested = searchParams.get("tool");
  const [activeTool, setActiveTool] = useState<ToolId>(requested === "clarification" ? "clarification" : "proposal");

  const budget = Number(searchParams.get("budget") || 0);
  const [form, setForm] = useState<ProcedureForm>({
    project_title: searchParams.get("project_title") || "",
    authority_name: searchParams.get("authority_name") || "",
    county: searchParams.get("county") || "",
    category: searchParams.get("category") || "infrastructura",
    estimated_value_ron: Number.isFinite(budget) ? budget : 0,
    contract_type: "",
    cpv_code: "",
    source_id: searchParams.get("source_id") || "",
    regime: "",
    authority_level: "",
  });
  const [tenderLoading, setTenderLoading] = useState(false);
  const [tenderNotice, setTenderNotice] = useState<string | null>(null);

  const [bidder, setBidderState] = useState<BidderIdentity>({});
  const setBidder = (b: BidderIdentity) => {
    setBidderState(b);
    storeBidder(b);
  };

  const [legalMeta, setLegalMeta] = useState<LegalMetadata | null>(null);
  const [legalLoading, setLegalLoading] = useState(false);
  const [preview, setPreview] = useState<Preview | null>(null);

  // The company is entered once: localStorage first, then the profile's
  // own billing identity as a fallback for a first visit.
  useEffect(() => {
    const stored = readStoredBidder();
    if (stored && (stored.cui || stored.company_name)) {
      setBidderState(stored);
    } else if (profile?.company_name || profile?.cui) {
      setBidderState({ company_name: profile.company_name || "", cui: profile.cui || "" });
    }
  }, [profile]);

  const loadTender = async (sourceId: string | undefined, fallback?: PickResult) => {
    setTenderNotice(null);
    const apply = (t: { project_title?: string; entity_name?: string; county?: string; category?: string; financial_value_ron?: number; cpv_code?: string; source_id?: string }) =>
      setForm((f) => ({
        ...f,
        project_title: t.project_title || f.project_title,
        authority_name: t.entity_name || f.authority_name,
        county: t.county || f.county,
        category: CATEGORIES.some((c) => c.id === t.category) ? (t.category as string) : f.category,
        estimated_value_ron: t.financial_value_ron || f.estimated_value_ron,
        cpv_code: t.cpv_code || f.cpv_code,
        contract_type: contractTypeFromCpv(t.cpv_code) || f.contract_type,
        source_id: t.source_id || f.source_id,
        regime: "",
        authority_level: "",
      }));
    if (!sourceId) {
      if (fallback) apply(fallback);
      return;
    }
    setTenderLoading(true);
    try {
      apply(await fetchOpportunity(sourceId));
    } catch (e) {
      if (fallback) {
        apply(fallback);
      } else {
        setTenderNotice(e instanceof ApiError && e.status === 404 ? `Anunțul ${sourceId} nu a fost găsit în baza de date.` : "Datele licitației nu au putut fi preluate.");
      }
    } finally {
      setTenderLoading(false);
    }
  };

  // /drafting?source_id=… (from the lead dossier) fills itself once.
  const initialSourceId = useRef(searchParams.get("source_id"));
  useEffect(() => {
    if (initialSourceId.current) loadTender(initialSourceId.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Live regime strip — debounced, since the value field fires per keystroke.
  useEffect(() => {
    if (!form.estimated_value_ron || !form.contract_type) {
      setLegalMeta(null);
      return;
    }
    let cancelled = false;
    setLegalLoading(true);
    const timer = setTimeout(async () => {
      try {
        const meta = await fetchLegalRegime({
          estimated_value_ron: form.estimated_value_ron,
          contract_type: form.contract_type || undefined,
          regime: form.regime || undefined,
          authority_level: form.authority_level || undefined,
          authority_name: form.authority_name || undefined,
        });
        if (!cancelled) setLegalMeta(meta);
      } catch {
        if (!cancelled) setLegalMeta(null);
      } finally {
        if (!cancelled) setLegalLoading(false);
      }
    }, 400);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [form.estimated_value_ron, form.contract_type, form.regime, form.authority_level, form.authority_name]);

  const shared = () => ({
    estimated_value_ron: form.estimated_value_ron || undefined,
    contract_type: form.contract_type || undefined,
    regime: form.regime || undefined,
    authority_level: form.authority_level || undefined,
    bidder,
  });

  const buildProposalBase = () => ({
    project_title: form.project_title,
    authority_name: form.authority_name,
    county: form.county,
    category: form.category,
    company_name: bidder.company_name || "",
    cui: bidder.cui || "",
    cpv_code: form.cpv_code || undefined,
    source_id: form.source_id || undefined,
    ...shared(),
  });

  const buildLetterBase = () => ({
    authority_name: form.authority_name,
    project_title: form.project_title,
    source_id: form.source_id,
    company_name: bidder.company_name || "",
    cui_fiscal: bidder.cui || "",
    contact_email: user?.email,
    ...shared(),
  });

  const set = (key: keyof ProcedureForm) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm({ ...form, [key]: e.target.value });

  return (
    <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-6 sm:py-8">
      <PageHeader
        eyebrow="Redactare documente"
        title="Documente de procedură"
        standfirst="Propuneri tehnice cu declarațiile obligatorii și adrese către autoritate pentru fiecare etapă a procedurii, cu temeiul legal citat din textele consolidate. Previzualizați, apoi exportați în .docx."
      />

      <div className="space-y-5">
        <Panel className="p-4 sm:p-5">
          <Eyebrow className="mb-3 border-b border-divider pb-2">Date procedură</Eyebrow>
          <TenderPicker onPick={loadTender} loadingId={tenderLoading} />
          {tenderNotice && <p className="font-body mt-1.5 text-xs text-negative">{tenderNotice}</p>}

          <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Field label="Titlu proiect" className="sm:col-span-2">
              <Input className={COMPACT_FIELD} value={form.project_title} onChange={set("project_title")} placeholder="Modernizare DJ 105…" />
            </Field>
            <Field label="Autoritate contractantă" className="sm:col-span-2">
              <Input className={COMPACT_FIELD} value={form.authority_name} onChange={set("authority_name")} />
            </Field>
            <Field label="Valoare estimată (lei, fără TVA)">
              <NumberInput className={COMPACT_FIELD} min={0} value={form.estimated_value_ron} onValueChange={(v) => setForm({ ...form, estimated_value_ron: v })} />
            </Field>
            <Field label="Tip contract">
              <Select className={COMPACT_FIELD} value={form.contract_type} onChange={set("contract_type")}>
                <option value="">Alegeți…</option>
                {CONTRACT_TYPES.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.label}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Domeniu">
              <Select className={COMPACT_FIELD} value={form.category} onChange={set("category")}>
                {CATEGORIES.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.label}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Județ">
              <Input className={COMPACT_FIELD} value={form.county} onChange={set("county")} />
            </Field>
            <Field label="Cod CPV">
              <Input
                className={COMPACT_FIELD}
                value={form.cpv_code}
                onChange={(e) =>
                  setForm({ ...form, cpv_code: e.target.value, contract_type: form.contract_type || contractTypeFromCpv(e.target.value) })
                }
                placeholder="45233120-6"
              />
            </Field>
            <Field label="ID anunț / sursă">
              <Input className={COMPACT_FIELD} value={form.source_id} onChange={set("source_id")} />
            </Field>
          </div>

          <LegalRegimeStrip meta={legalMeta} loading={legalLoading} form={form} setForm={setForm} />
        </Panel>

        <BidderCard bidder={bidder} setBidder={setBidder} />

        <TabBar tabs={TOOLS} active={activeTool} onChange={setActiveTool} label="Instrument de redactare" />

        {activeTool === "proposal" ? (
          <ProposalTool buildBase={buildProposalBase} onPreview={(result, payload) => setPreview({ kind: "proposal", result, payload })} />
        ) : (
          <LetterTool
            initialType="clarification"
            buildBase={buildLetterBase}
            onPreview={(result, payload) => setPreview({ kind: "letter", result, payload })}
          />
        )}
      </div>

      {preview?.kind === "proposal" && (
        <DocumentPreviewPanel
          eyebrow={`Propunere tehnică${preview.result.requirements_count ? ` · ${preview.result.requirements_count} cerințe din caiet` : ""}`}
          title={preview.result.project_title}
          subtitle={`${preview.result.authority_name} · ${preview.result.company_name || "ofertant necompletat"}`}
          sections={preview.result.structured_sections || []}
          complianceRows={preview.result.compliance_rows}
          declarations={preview.result.declarations}
          legalBasis={[
            ...(preview.result.statutory_basis?.technical_specifications || []),
            ...(preview.result.statutory_basis?.exclusion_grounds || []),
          ]}
          legalMetadata={preview.result.legal_metadata}
          disclaimer={preview.result.disclaimer}
          plainText={preview.result.dossier_text}
          onExport={() => exportDossierDocx(preview.payload)}
          onClose={() => setPreview(null)}
        />
      )}
      {preview?.kind === "letter" && (
        <DocumentPreviewPanel
          eyebrow={preview.result.document_type || "Adresă"}
          title={preview.result.doc_title || "Adresă către autoritate"}
          subtitle={`Destinatar: ${preview.result.recipient || preview.payload.authority_name}${preview.result.reference_id ? ` · Ref. ${preview.result.reference_id}` : ""}`}
          sections={preview.result.sections || [{ paragraphs: [preview.result.generated_letter] }]}
          legalBasis={preview.result.legal_basis_verified}
          counselNotes={preview.result.counsel_notes}
          legalMetadata={preview.result.legal_metadata}
          disclaimer={preview.result.disclaimer}
          plainText={preview.result.generated_letter}
          onExport={() => exportClarificationDocx(preview.payload)}
          onClose={() => setPreview(null)}
        />
      )}
    </main>
  );
}

export default function DraftingPage() {
  return (
    <AuthGate
      title="Generatorul de documente este pentru abonați"
      description="Redactarea propunerilor tehnice și a solicitărilor oficiale necesită un cont autentificat."
    >
      <Suspense
        fallback={
          <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-10">
            <Loading />
          </main>
        }
      >
        <DraftingContent />
      </Suspense>
    </AuthGate>
  );
}
