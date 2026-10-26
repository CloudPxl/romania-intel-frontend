"use client";
import { Suspense, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { useCompanyProfile } from "@/context/CompanyProfileContext";
import { userKey } from "@/lib/userStorage";
import AuthGate from "@/components/AuthGate";
import AiCredits from "@/components/AiCredits";
import Explain from "@/components/Explain";
import DocumentPreviewPanel from "@/components/DocumentPreviewPanel";
import {
  ApiError,
  exportClarificationDocx,
  exportDossierDocx,
  fetchArtifact,
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
  type PreSeapMode,
  type LetterType,
  type TechnicalProposalRequest,
  type TechnicalProposalResult,
} from "@/lib/api";
import { CATEGORIES, formatDate, formatNumber, formatRon } from "@/lib/format";
import { takeClauses } from "@/lib/toolLinks";
import { useActiveTender } from "@/context/CopilotContext";
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
const ACTION_BUTTON = "border-transparent bg-editorial text-white hover:bg-editorial-light";

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
  { id: "sanctions_5k", label: "Sancțiuni UE – art. 5k Reg. 833/2014" },
  { id: "beneficial_owner", label: "Beneficiar real (Legea 129/2019)" },
  { id: "dnsh", label: "DNSH – „a nu prejudicia semnificativ”" },
];
// Always on by default: the four every procedure asks for, plus art. 5k,
// which applies to every procurement under the directives. Beneficial owner
// and DNSH follow the tender's funding (Lead.suggested_declarations).
const DEFAULT_DECLARATIONS: DeclarationId[] = ["env_social", "conflict_of_interest", "confidentiality", "exclusion", "sanctions_5k"];

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
  { id: "indicatori_tehnico_economici", label: "Indicatori tehnico-economici" },
  { id: "calendar_achizitie", label: "Calendarul procedurii" },
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
              <dt className="font-sans text-[10px] font-semibold uppercase tracking-widest text-stock-500">Termen contestație</dt>
              {meta.cnsc_deadline_days ? (
                <>
                  <dd className="font-display text-sm font-semibold">CNSC · {meta.cnsc_deadline_days} zile</dd>
                  <dd className="font-mono text-[10px] text-stock-500">{(meta.cnsc_deadline_basis || "").replace("din Legea nr. 101/2016", "L101/2016")}</dd>
                </>
              ) : (
                <>
                  <dd className="font-display text-sm font-semibold">Instanța de contencios</dd>
                  <dd className="font-mono text-[10px] text-stock-500">{meta.direct_award?.challenge_basis || "Legea nr. 554/2004"}</dd>
                </>
              )}
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
          {/* The money side of the bid, from the same statute: what the
              guarantees can cost, where the 80% presumption starts, and the
              rate a life-cycle cost is discounted at. */}
          <dl className="mt-3 grid grid-cols-2 gap-x-6 gap-y-2 border-t border-divider pt-2.5 sm:grid-cols-4">
            {meta.guarantees && (
              <>
                <div>
                  <dt className="font-sans text-[10px] font-semibold uppercase tracking-widest text-stock-500">Garanție participare</dt>
                  <dd className="font-display text-sm font-semibold tabular">max {formatNumber(meta.guarantees.participation_max_ron)} lei</dd>
                  <dd className="font-mono text-[10px] text-stock-500">≤ 1% · dacă e cerută</dd>
                </div>
                <div>
                  <dt className="font-sans text-[10px] font-semibold uppercase tracking-widest text-stock-500">Garanție bună execuție</dt>
                  <dd className="font-display text-sm font-semibold tabular">max {formatNumber(meta.guarantees.performance_max_ron)} lei</dd>
                  <dd className="font-mono text-[10px] text-stock-500">≤ 10% din preț</dd>
                </div>
              </>
            )}
            {meta.abnormally_low?.threshold_ron != null && (
              <div>
                <dt className="font-sans text-[10px] font-semibold uppercase tracking-widest text-stock-500">Prag preț 80%</dt>
                <dd className="font-display text-sm font-semibold tabular">{formatNumber(meta.abnormally_low.threshold_ron)} lei</dd>
                <dd className="font-mono text-[10px] text-stock-500" title={meta.abnormally_low.presumption_basis}>sub el: prezumție art. 210</dd>
              </div>
            )}
            {meta.discount_rate && (
              <div>
                <dt className="font-sans text-[10px] font-semibold uppercase tracking-widest text-stock-500">Rată de actualizare {meta.discount_rate.year}</dt>
                <dd className="font-display text-sm font-semibold tabular">{String(meta.discount_rate.rate_pct).replace(".", ",")}%</dd>
                <dd className="font-mono text-[10px] text-stock-500" title={meta.discount_rate.scope}>Ord. ANAP 12/2026 · cost ciclu de viață</dd>
              </div>
            )}
          </dl>
          {meta.direct_award && (
            <p className="font-body mt-2 text-xs leading-relaxed text-stock-600">
              Achiziție directă: <span className="font-semibold">{meta.direct_award.tier}</span> ({meta.direct_award.basis}).
            </p>
          )}
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
          {meta.verification && (
            <p
              className={
                "font-mono mt-2 text-[10px] leading-relaxed " +
                (meta.verification.status === "mismatch" ? "text-negative" : "text-stock-500")
              }
              title={meta.verification.issues.join("\n") || meta.transitional_note}
            >
              {meta.verification.status === "mismatch"
                ? `Atenție: verificarea automată a găsit diferențe față de textul legii — ${meta.verification.issues[0]}`
                : `✓ Praguri și texte verificate pe legislatie.just.ro · ${meta.verification.checked_at ? formatDate(meta.verification.checked_at) : "—"}`}
            </p>
          )}
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
        <span className="font-mono shrink-0 text-[11px] text-accent">{open ? "Restrânge" : "Editează"}</span>
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

/** "Nume — data nașterii — cetățenie — mod de control", one per line. */
function parseOwners(text: string) {
  return text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [name, birth_date, citizenship, ...control] = line.split(/\s+[—–]\s+|\s*;\s*/);
      return { name: name.trim(), birth_date: birth_date?.trim() || undefined, citizenship: citizenship?.trim() || undefined, control: control.join("; ").trim() || undefined };
    });
}

/** "Denumire — calitate — țara — pondere", one per line. */
function parsePartners(text: string) {
  return text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [name, role, country, share] = line.split(/\s+[—–]\s+|\s*;\s*/);
      return { name: name.trim(), role: role?.trim() || undefined, country: country?.trim() || undefined, share: share?.trim() || undefined };
    });
}

interface ProposalState {
  declarations: DeclarationId[];
  decisionMakers: string;
  beneficialOwners: string;
  sanctionsPartners: string;
  requirements: string;
  aiMode: boolean;
}

const EMPTY_PROPOSAL: ProposalState = {
  declarations: DEFAULT_DECLARATIONS,
  decisionMakers: "",
  beneficialOwners: "",
  sanctionsPartners: "",
  requirements: "",
  aiMode: false,
};

function ProposalTool({
  initial,
  onChange,
  buildBase,
  onPreview,
}: {
  initial: ProposalState;
  onChange: (state: ProposalState) => void;
  buildBase: () => Omit<TechnicalProposalRequest, "include_declarations">;
  onPreview: (result: TechnicalProposalResult, payload: TechnicalProposalRequest) => void;
}) {
  const [declarations, setDeclarations] = useState<DeclarationId[]>(initial.declarations);
  const [decisionMakers, setDecisionMakers] = useState(initial.decisionMakers);
  const [beneficialOwners, setBeneficialOwners] = useState(initial.beneficialOwners || "");
  const [sanctionsPartners, setSanctionsPartners] = useState(initial.sanctionsPartners || "");
  const [requirements, setRequirements] = useState(initial.requirements);
  const [aiMode, setAiMode] = useState(initial.aiMode);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    onChange({ declarations, decisionMakers, beneficialOwners, sanctionsPartners, requirements, aiMode });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [declarations, decisionMakers, beneficialOwners, sanctionsPartners, requirements, aiMode]);

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
      beneficial_owners: declarations.includes("beneficial_owner") ? parseOwners(beneficialOwners) : [],
      sanctions_partners: declarations.includes("sanctions_5k") ? parsePartners(sanctionsPartners) : [],
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
      {declarations.includes("beneficial_owner") && (
        <div className="mt-3">
          <Field label="Beneficiari reali" hint="Ca în declarația depusă la ONRC — unul pe rând: Nume — data nașterii — cetățenie — mod de control. Lăsat gol, tabelul rămâne de completat.">
            <Textarea className="min-h-[4rem] py-2" value={beneficialOwners} onChange={(e) => setBeneficialOwners(e.target.value)} placeholder={"Ion Popescu — 12.03.1975 — română — 60% din părțile sociale"} />
          </Field>
        </div>
      )}
      {declarations.includes("sanctions_5k") && (
        <div className="mt-3">
          <Field label="Subcontractanți / furnizori peste 10% din valoare (art. 5k)" hint="Unul pe rând: Denumire — calitate — țara de stabilire — pondere. Lăsat gol, tabelul rămâne de completat.">
            <Textarea className="min-h-[4rem] py-2" value={sanctionsPartners} onChange={(e) => setSanctionsPartners(e.target.value)} placeholder={"Alfa Instal SRL — subcontractant — România — 18%"} />
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

interface LetterState {
  type: LetterType;
  points: string;
  deadline: string;
  evalRef: string;
  resultDate: string;
  offeredPrice: number;
  breakdown: Record<string, number>;
  presets: string[];
  useAi: boolean;
}

const EMPTY_LETTER: LetterState = {
  type: "clarification",
  points: "",
  deadline: "",
  evalRef: "",
  resultDate: "",
  offeredPrice: 0,
  breakdown: {},
  presets: ["paap"],
  useAi: false,
};

/** The Legea 544 presets named in the URL, or the default when none is valid. */
function presetsFromParam(value: string | null): string[] {
  const ids = (value || "").split(",").filter((p) => FOIA_PRESETS.some((x) => x.id === p));
  return ids.length ? ids : EMPTY_LETTER.presets;
}

function LetterTool({
  initial,
  onChange,
  handoffNote,
  buildBase,
  onPreview,
}: {
  initial: LetterState;
  onChange: (state: LetterState) => void;
  /** Set when clauses arrived from the caiet scanner, so the user knows
   *  where the pre-filled points came from. */
  handoffNote?: string | null;
  buildBase: () => Omit<ClarificationRequest, "clarification_points" | "request_type">;
  onPreview: (result: ClarificationResult, payload: ClarificationRequest) => void;
}) {
  const [type, setType] = useState<LetterType>(initial.type);
  const [points, setPoints] = useState(initial.points);
  const [deadline, setDeadline] = useState(initial.deadline);
  const [evalRef, setEvalRef] = useState(initial.evalRef);
  const [resultDate, setResultDate] = useState(initial.resultDate);
  const [offeredPrice, setOfferedPrice] = useState(initial.offeredPrice);
  const [breakdown, setBreakdown] = useState<Record<string, number>>(initial.breakdown);
  const [presets, setPresets] = useState<string[]>(initial.presets);
  const [useAi, setUseAi] = useState(initial.useAi);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    onChange({ type, points, deadline, evalRef, resultDate, offeredPrice, breakdown, presets, useAi });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [type, points, deadline, evalRef, resultDate, offeredPrice, breakdown, presets, useAi]);

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
              (type === opt.id ? "border-2 border-editorial bg-editorial-soft" : "neu-flat-sm hover:neu-flat")
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
                  (active ? "neu-pressed-sm bg-editorial-soft font-medium text-accent" : "neu-flat-sm bg-paper text-stock-600 hover:neu-lift")
                }
              >
                {p.label}
              </button>
            );
          })}
        </div>
      )}

      <div className="mt-4">
        {handoffNote && (
          <div className="mb-3">
            <Notice tone="neutral">{handoffNote}</Notice>
          </div>
        )}
        <Field label={spec.pointsLabel}>
          <Textarea value={points} onChange={(e) => setPoints(e.target.value)} className="min-h-[7rem]" placeholder={spec.placeholder} />
        </Field>
      </div>

      <div className="mt-3 flex flex-col gap-3 border-t border-divider pt-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="neu-pressed-sm inline-flex rounded-2xl bg-paper p-1" role="group" aria-label="Mod de generare">
          {[
            { on: false, label: "Șablon · fără AI" },
            { on: true, label: "Fundamentare cu AI" },
          ].map((opt) => (
            <button
              key={opt.label}
              type="button"
              onClick={() => setUseAi(opt.on)}
              aria-pressed={useAi === opt.on}
              className={
                "min-h-9 rounded-xl px-3 font-body text-xs transition-all duration-300 " +
                (useAi === opt.on ? "neu-flat-sm bg-paper font-semibold text-ink" : "text-stock-500 hover:text-ink")
              }
            >
              {opt.label}
            </button>
          ))}
        </div>
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

const LETTER_IDS = new Set<LetterType>(["clarification", "evaluation_response", "abnormally_low_price", "dossier_access", "foia"]);
const AUTOSAVE_PREFIX = "ro_intel_drafting_autosave:";

interface Autosave {
  form: ProcedureForm;
  proposal: ProposalState;
  letter: LetterState;
  saved_at: string;
}

function readAutosave(key: string): Autosave | null {
  try {
    const raw = window.localStorage.getItem(AUTOSAVE_PREFIX + key);
    return raw ? (JSON.parse(raw) as Autosave) : null;
  } catch {
    return null;
  }
}

function writeAutosave(key: string, data: Autosave) {
  try {
    window.localStorage.setItem(AUTOSAVE_PREFIX + key, JSON.stringify(data));
  } catch {
    // Quota or private mode: nothing to recover later, the form still works.
  }
}

function DraftingContent() {
  const { profile, user } = useAuth();
  const company = useCompanyProfile();
  const searchParams = useSearchParams();
  // ?tab=propunere|clarificari is the link every other tool builds; ?tool=
  // is the older spelling and still honoured.
  const tabParam = searchParams.get("tab") || searchParams.get("tool");
  const letterParam = searchParams.get("letter") as LetterType | null;
  const [activeTool, setActiveTool] = useState<ToolId>(
    tabParam === "clarificari" || tabParam === "clarification" || letterParam ? "clarification" : "proposal"
  );

  const budget = Number(searchParams.get("budget") || searchParams.get("estimated") || 0);
  const emptyForm: ProcedureForm = {
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
  };
  const [form, setForm] = useState<ProcedureForm>(emptyForm);
  // The copilot reads "licitația asta" as the tender this form is for.
  useActiveTender(form.source_id || null, form.project_title || null);
  const [tenderLoading, setTenderLoading] = useState(false);
  const [tenderNotice, setTenderNotice] = useState<string | null>(null);
  // A permit, an environmental agreement, a council decision: no procedure
  // yet, so the regime strip (procedure, CNSC term, cauțiune) does not apply.
  const [preSeap, setPreSeap] = useState<PreSeapMode | null>(null);
  const [declarationsNote, setDeclarationsNote] = useState<string | null>(null);

  // What the two tools start from — restored from an autosave, a reopened
  // document or a hand-off from another page. `toolsKey` remounts them when
  // it changes, since their own state is initialised once.
  const [proposalInit, setProposalInit] = useState<ProposalState>(EMPTY_PROPOSAL);
  const [letterInit, setLetterInit] = useState<LetterState>({
    ...EMPTY_LETTER,
    type: letterParam && LETTER_IDS.has(letterParam) ? letterParam : "clarification",
    offeredPrice: Number(searchParams.get("offered") || 0) || 0,
    // ?presets= comes from a pre-SEAP signal's "Cerere Legea 544" button.
    presets: presetsFromParam(searchParams.get("presets")),
  });
  const [toolsKey, setToolsKey] = useState(0);
  const [handoffNote, setHandoffNote] = useState<string | null>(null);
  const [restoredNote, setRestoredNote] = useState<string | null>(null);
  const latest = useRef<{ proposal: ProposalState; letter: LetterState }>({ proposal: proposalInit, letter: letterInit });

  // The bidder lives in the shared company profile: looked up on
  // Eligibilitate or here, it fills every header after that.
  const bidder: BidderIdentity = company.bidder || {};
  const setBidder = (b: BidderIdentity) => {
    company.save({
      cui: b.cui || null,
      company_name: b.company_name || null,
      registration_number: b.trade_register_no || null,
      address: b.headquarters || null,
      legal_representative: b.legal_representative || null,
      representative_role: b.representative_role || null,
    });
  };

  const [legalMeta, setLegalMeta] = useState<LegalMetadata | null>(null);
  const [legalLoading, setLegalLoading] = useState(false);
  const [preview, setPreview] = useState<Preview | null>(null);
  // Re-reads the credits meter after each generation, which may have spent one.
  const [creditsKey, setCreditsKey] = useState(0);
  const openPreview = (p: Preview) => {
    setPreview(p);
    setCreditsKey((k) => k + 1);
  };

  // One source of truth for the bidder: the shared company profile. An
  // account that has none yet starts from the name and CUI it gave at
  // onboarding (the old drafting-only browser store is gone — it was not
  // per user).
  useEffect(() => {
    if (company.profile?.company_name || company.profile?.cui) return;
    if (profile?.company_name || profile?.cui) setBidder({ company_name: profile.company_name || "", cui: profile.cui || "" });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile, company.profile]);
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
      const tender = await fetchOpportunity(sourceId);
      apply(tender);
      setPreSeap(tender.record_kind === "PRE_TENDER_SIGNAL" ? tender.pre_seap ?? null : null);
      const missing = (tender.suggested_declarations || []).filter((d) => !latest.current.proposal.declarations.includes(d));
      if (missing.length) {
        setProposalInit({ ...latest.current.proposal, declarations: [...latest.current.proposal.declarations, ...missing] });
        setToolsKey((k) => k + 1);
        setDeclarationsNote(
          `Finanțare: ${tender.funding_source || "fonduri UE"} — am adăugat ${missing
            .map((d) => DECLARATIONS.find((x) => x.id === d)?.label || d)
            .join(", ")}.`
        );
      }
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

  // Arrival: a reopened document wins, then clauses handed over from the
  // caiet scanner, then the autosave for this tender, then the tender's own
  // record. Each later source only fills what the earlier ones left empty.
  const initialised = useRef(false);
  useEffect(() => {
    if (initialised.current) return;
    initialised.current = true;
    const sourceId = searchParams.get("source_id");
    const artifactId = searchParams.get("artifact");
    const clausesKey = searchParams.get("clauses");
    (async () => {
      if (artifactId) {
        try {
          const art = await fetchArtifact(artifactId);
          const pl = art.payload as Record<string, unknown>;
          setForm((f) => ({
            ...f,
            project_title: (pl.project_title as string) || f.project_title,
            authority_name: (pl.authority_name as string) || f.authority_name,
            county: (pl.county as string) || f.county,
            category: (pl.category as string) || f.category,
            estimated_value_ron: (pl.estimated_value_ron as number) || f.estimated_value_ron,
            contract_type: (pl.contract_type as ContractType) || f.contract_type,
            cpv_code: (pl.cpv_code as string) || f.cpv_code,
            source_id: (pl.source_id as string) || f.source_id,
            regime: (pl.regime as LegalRegime) || "",
            authority_level: (pl.authority_level as AuthorityLevel) || "",
          }));
          if (art.kind === "propunere_tehnica") {
            setActiveTool("proposal");
            setProposalInit({
              declarations: (pl.include_declarations as DeclarationId[]) || EMPTY_PROPOSAL.declarations,
              decisionMakers: ((pl.decision_makers as { name: string; role?: string }[]) || [])
                .map((d) => (d.role ? `${d.name} — ${d.role}` : d.name))
                .join("\n"),
              beneficialOwners: ((pl.beneficial_owners as { name: string; birth_date?: string; citizenship?: string; control?: string }[]) || [])
                .map((o) => [o.name, o.birth_date, o.citizenship, o.control].filter(Boolean).join(" — "))
                .join("\n"),
              sanctionsPartners: ((pl.sanctions_partners as { name: string; role?: string; country?: string; share?: string }[]) || [])
                .map((o) => [o.name, o.role, o.country, o.share].filter(Boolean).join(" — "))
                .join("\n"),
              requirements: (pl.cerinte_caiet as string) || "",
              aiMode: Boolean(pl.use_ai_expansion),
            });
          } else {
            setActiveTool("clarification");
            setLetterInit({
              type: (pl.request_type as LetterType) || "clarification",
              points: (pl.clarification_points as string) || "",
              deadline: (pl.procedure_deadline as string) || "",
              evalRef: (pl.evaluation_request_ref as string) || "",
              resultDate: (pl.result_communication_date as string) || "",
              offeredPrice: (pl.offered_price_ron as number) || 0,
              breakdown: (pl.price_breakdown as Record<string, number>) || {},
              presets: (pl.foia_presets as string[]) || ["paap"],
              useAi: Boolean(pl.use_ai_expansion),
            });
          }
          setToolsKey((k) => k + 1);
          setRestoredNote(`Redeschis din documentul „${art.title}” (${formatDate(art.created_at)}).`);
          return;
        } catch {
          setRestoredNote("Documentul salvat nu a putut fi încărcat — formularul pornește din datele licitației.");
        }
      }

      const handoff = takeClauses(clausesKey);
      if (handoff?.points.length) {
        setActiveTool("clarification");
        setLetterInit((l) => ({
          ...l,
          type: "clarification",
          points: handoff.points.map((pt, i) => `${i + 1}. ${pt}`).join("\n\n"),
        }));
        setToolsKey((k) => k + 1);
        setHandoffNote(
          `${handoff.points.length} ${handoff.points.length === 1 ? "clauză preluată" : "clauze preluate"} ${handoff.origin === "copilot" ? "din Copilot" : "din scanerul de caiet"}` +
            (handoff.citations.length ? `, cu temeiurile: ${handoff.citations.slice(0, 4).join("; ")}${handoff.citations.length > 4 ? "…" : ""}` : "") +
            ". Verificați formularea înainte de transmitere."
        );
      } else {
        const saved = readAutosave(userKey(sourceId || "nou", user?.user_id));
        if (saved && !letterParam) {
          setForm(saved.form);
          setProposalInit({ ...EMPTY_PROPOSAL, ...saved.proposal });
          setLetterInit(saved.letter);
          setToolsKey((k) => k + 1);
          setRestoredNote(`Ciorna salvată automat pe ${formatDate(saved.saved_at)} a fost restaurată.`);
          return;
        }
      }
      if (sourceId) await loadTender(sourceId);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Autosave, debounced, per tender: a refresh or a closed tab must not cost
  // an evaluation response written over an hour.
  // Per user as well: a draft is one person's work (lib/userStorage.ts).
  const autosaveKey = userKey(form.source_id || "nou", user?.user_id);
  const scheduleAutosave = useRef<ReturnType<typeof setTimeout> | null>(null);
  const autosave = () => {
    if (scheduleAutosave.current) clearTimeout(scheduleAutosave.current);
    scheduleAutosave.current = setTimeout(() => {
      writeAutosave(autosaveKey, { form, ...latest.current, saved_at: new Date().toISOString() });
    }, 600);
  };
  useEffect(() => {
    if (initialised.current) autosave();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form]);

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
    <main className="mx-auto w-full max-w-[1064px] flex-1 px-5 pb-16 pt-8 sm:px-8 sm:pt-12">
      <PageHeader
        eyebrow="Redactare documente"
        title="Documente de procedură"
        standfirst="Propuneri tehnice cu declarațiile obligatorii și adrese către autoritate pentru fiecare etapă a procedurii, cu temeiul legal citat din textele consolidate. Previzualizați, apoi exportați în .docx."
        action={<AiCredits refreshKey={creditsKey} />}
      />

      <div className="space-y-5">
        <Panel className="p-4 sm:p-5">
          <Eyebrow className="mb-3 border-b border-divider pb-2">Date procedură</Eyebrow>
          <TenderPicker onPick={loadTender} loadingId={tenderLoading} />
          {tenderNotice && <p className="font-body mt-1.5 text-xs text-negative">{tenderNotice}</p>}
          {declarationsNote && <p className="font-body mt-1.5 text-xs text-stock-600">{declarationsNote}</p>}

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

          {preSeap ? (
            <div className="mt-4">
              <Notice tone="neutral" title={`Semnal pre-SEAP · ${preSeap.signal_label}`}>
                {preSeap.not_applicable} Scrisoarea potrivită este „Informații publice” (Legea nr. 544/2001).
              </Notice>
            </div>
          ) : (
            <LegalRegimeStrip meta={legalMeta} loading={legalLoading} form={form} setForm={setForm} />
          )}
        </Panel>

        <BidderCard bidder={bidder} setBidder={setBidder} />

        <TabBar tabs={TOOLS} active={activeTool} onChange={setActiveTool} label="Instrument de redactare" />

        {restoredNote && (
          <p className="font-mono text-[11px] text-stock-500" role="status">
            {restoredNote}
          </p>
        )}

        {/* Both tools stay mounted so switching tabs keeps what was typed;
            the inactive one is only hidden. */}
        <div hidden={activeTool !== "proposal"}>
          <ProposalTool
            key={`p-${toolsKey}`}
            initial={proposalInit}
            onChange={(state) => {
              latest.current.proposal = state;
              autosave();
            }}
            buildBase={buildProposalBase}
            onPreview={(result, payload) => openPreview({ kind: "proposal", result, payload })}
          />
        </div>
        <div hidden={activeTool !== "clarification"}>
          <LetterTool
            key={`l-${toolsKey}`}
            initial={letterInit}
            handoffNote={handoffNote}
            onChange={(state) => {
              latest.current.letter = state;
              autosave();
            }}
            buildBase={buildLetterBase}
            onPreview={(result, payload) => openPreview({ kind: "letter", result, payload })}
          />
        </div>
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
          aiNotice={preview.result.ai_quota}
          legalIssues={preview.result.legal_issues}
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
          aiNotice={preview.result.ai_quota}
          legalIssues={preview.result.legal_issues}
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
      title="Redactare documente"
      description="Propunere tehnică, declarații, clarificări și justificarea prețului, exportate în .docx."
    >
      <Suspense
        fallback={
          <main className="mx-auto w-full max-w-[1064px] flex-1 px-5 pb-16 pt-8 sm:px-8 sm:pt-12">
            <Loading />
          </main>
        }
      >
        <DraftingContent />
      </Suspense>
    </AuthGate>
  );
}
