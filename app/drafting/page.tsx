"use client";
import React, { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import AuthGate from "@/components/AuthGate";
import {
  ApiError,
  exportClarificationDocx,
  exportDossierDocx,
  generateLegalClarification,
  generateTechnicalProposal,
  type ClarificationRequest,
  type ClarificationResult,
  type TechnicalProposalRequest,
  type TechnicalProposalResult,
} from "@/lib/api";
import { CATEGORIES } from "@/lib/format";
import {
  Button,
  Checkbox,
  Eyebrow,
  Field,
  Input,
  Loading,
  Notice,
  PageHeader,
  Panel,
  Select,
  TabBar,
  Textarea,
} from "@/components/newsprint";

const TOOLS = [
  { id: "proposal", label: "Propunere tehnică" },
  { id: "clarification", label: "Clarificări & Legea 544" },
] as const;

type ToolId = (typeof TOOLS)[number]["id"];

/** Copy-to-clipboard that reports failure instead of silently doing nothing. */
function useCopy() {
  const [copied, setCopied] = useState(false);
  const [failed, setFailed] = useState(false);
  const copy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setFailed(false);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard access is denied outside a secure context and in some
      // embedded webviews — say so rather than showing a false "Copiat".
      setFailed(true);
      setTimeout(() => setFailed(false), 4000);
    }
  };
  return { copied, failed, copy };
}

function DocumentOutput({
  text,
  onCopy,
  copied,
  failed,
  onExport,
  exporting,
}: {
  text: string;
  onCopy: () => void;
  copied: boolean;
  failed: boolean;
  onExport: () => void;
  exporting: boolean;
}) {
  return (
    <div className="mt-6 neu-pressed overflow-hidden rounded-2xl bg-paper">
      <div className="flex flex-col gap-2 border-b border-divider px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
        <Eyebrow>Document generat</Eyebrow>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={onCopy}>
            {copied ? "Copiat" : failed ? "Copierea a eșuat" : "Copiază textul"}
          </Button>
          <Button onClick={onExport} disabled={exporting}>
            {exporting ? "Se exportă…" : "Descarcă .docx"}
          </Button>
        </div>
      </div>
      <pre className="scroll-x font-body max-h-[32rem] overflow-y-auto bg-surface p-4 text-sm leading-relaxed whitespace-pre-wrap sm:p-6">
        {text}
      </pre>
    </div>
  );
}

/* --------------------------------------------------------------- proposal */

function TechnicalProposalTool({
  initial,
}: {
  initial: { project_title: string; authority_name: string; county: string; category: string; source_id: string; budget: string };
}) {
  const { profile } = useAuth();
  const [form, setForm] = useState({
    project_title: initial.project_title,
    authority_name: initial.authority_name,
    county: initial.county || "",
    category: initial.category || "infrastructura",
    source_id: initial.source_id || "",
    cpv_code: "",
    estimated_value_ron: initial.budget ? Number(initial.budget) : 0,
  });
  const [useAi, setUseAi] = useState(false);
  const [caietText, setCaietText] = useState("");
  const [data, setData] = useState<TechnicalProposalResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { copied, failed, copy } = useCopy();

  const payload = (): TechnicalProposalRequest => ({
    project_title: form.project_title,
    authority_name: form.authority_name,
    county: form.county,
    category: form.category,
    company_name: profile?.company_name || "",
    cui: profile?.cui || "",
    estimated_value_ron: form.estimated_value_ron || undefined,
    cpv_code: form.cpv_code || undefined,
    source_id: form.source_id || undefined,
    use_ai_expansion: useAi,
    caiet_text: useAi && caietText.trim() ? caietText : undefined,
  });

  const handleGenerate = async () => {
    if (!form.project_title.trim() || !form.authority_name.trim()) {
      setError("Titlul proiectului și autoritatea contractantă sunt obligatorii.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      setData(await generateTechnicalProposal(payload()));
    } catch (e) {
      setError(e instanceof ApiError ? e.detail : "Generarea propunerii a eșuat.");
    } finally {
      setLoading(false);
    }
  };

  const handleExport = async () => {
    setExporting(true);
    setError(null);
    try {
      await exportDossierDocx(payload());
    } catch (e) {
      setError(e instanceof ApiError ? e.detail : "Exportul .docx a eșuat.");
    } finally {
      setExporting(false);
    }
  };

  return (
    <Panel className="p-4 sm:p-6">
      <h2 className="font-display text-2xl font-bold leading-tight tracking-tight">
        Propunere tehnică — Legea 98/2016
      </h2>
      <p className="font-body mt-1.5 text-sm leading-relaxed text-stock-600">
        Structură pe secțiuni conform standardelor naționale de achiziții, cu tabel de conformitate și declarații
        aferente. Textul rezultat este un document complet și fără expansiune AI.
      </p>

      <div className="mt-6 grid grid-cols-1 gap-5 sm:grid-cols-2">
        <Field label="Titlu proiect" className="sm:col-span-2">
          <Input
            value={form.project_title}
            onChange={(e) => setForm({ ...form, project_title: e.target.value })}
            placeholder="Modernizare DJ 105…"
          />
        </Field>
        <Field label="Autoritate contractantă">
          <Input
            value={form.authority_name}
            onChange={(e) => setForm({ ...form, authority_name: e.target.value })}
          />
        </Field>
        <Field label="Județ">
          <Input value={form.county} onChange={(e) => setForm({ ...form, county: e.target.value })} />
        </Field>
        <Field label="Domeniu">
          <Select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
            {CATEGORIES.map((c) => (
              <option key={c.id} value={c.id}>
                {c.label}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Valoare estimată (RON)" hint="Determină tipul de procedură menționat în document.">
          <Input
            type="number"
            min={0}
            value={form.estimated_value_ron || ""}
            onChange={(e) => setForm({ ...form, estimated_value_ron: Number(e.target.value) })}
          />
        </Field>
        <Field label="Cod CPV" hint="Opțional.">
          <Input value={form.cpv_code} onChange={(e) => setForm({ ...form, cpv_code: e.target.value })} placeholder="45233120-6" />
        </Field>
        <Field label="ID anunț / sursă" hint="Opțional.">
          <Input value={form.source_id} onChange={(e) => setForm({ ...form, source_id: e.target.value })} />
        </Field>
      </div>

      <div className="mt-6 border-t border-divider pt-4">
        <Checkbox
          label="Extinde metodologia și analiza de risc cu AI"
          checked={useAi}
          onChange={(e) => setUseAi(e.target.checked)}
        />
        <p className="font-body ml-7 -mt-1 text-xs leading-relaxed text-stock-500">
          Adaugă câteva secunde de procesare. Dacă niciun furnizor AI nu este configurat pe server, documentul este
          returnat în forma sa completă din șablon.
        </p>
        {useAi && (
          <div className="mt-4">
            <Field label="Extras din caietul de sarcini" hint="Face expansiunea specifică acestei proceduri.">
              <Textarea
                value={caietText}
                onChange={(e) => setCaietText(e.target.value)}
                placeholder="Lipiți cerințele tehnice relevante…"
              />
            </Field>
          </div>
        )}
      </div>

      {error && (
        <div className="mt-5">
          <Notice tone="alert">{error}</Notice>
        </div>
      )}

      <Button onClick={handleGenerate} disabled={loading} fullWidth className="mt-6">
        {loading ? "Se asamblează propunerea…" : "Generează propunerea"}
      </Button>

      {loading && (
        <div className="mt-6">
          <Loading label="Se redactează documentul" />
        </div>
      )}

      {data && !loading && (
        <>
          <p className="font-mono mt-6 text-[11px] uppercase tracking-wider text-stock-500">
            Emis pentru: <span className="text-ink">{data.company_name}</span>
            {data.cui && ` · ${data.cui}`}
          </p>
          <DocumentOutput
            text={data.dossier_text}
            onCopy={() => copy(data.dossier_text)}
            copied={copied}
            failed={failed}
            onExport={handleExport}
            exporting={exporting}
          />
          {data.disclaimer && (
            <p className="font-mono mt-4 text-[11px] leading-relaxed text-stock-500">{data.disclaimer}</p>
          )}
        </>
      )}
    </Panel>
  );
}

/* ---------------------------------------------------------- clarification */

function ClarificationTool({
  initial,
}: {
  initial: { project_title: string; authority_name: string; source_id: string };
}) {
  const { profile, user } = useAuth();
  const [form, setForm] = useState({
    authority_name: initial.authority_name,
    project_title: initial.project_title,
    source_id: initial.source_id,
    procedure_deadline: "",
  });
  const [requestType, setRequestType] = useState<"clarification" | "foia">("clarification");
  const [points, setPoints] = useState(
    "1. Solicităm eliminarea cerinței de autorizație directă de la producător.\n2. Solicităm acceptarea standardelor tehnice europene echivalente, conform Art. 160 din Legea 98/2016."
  );
  const [useAi, setUseAi] = useState(false);
  const [data, setData] = useState<ClarificationResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { copied, failed, copy } = useCopy();

  const payload = (): ClarificationRequest => ({
    authority_name: form.authority_name,
    project_title: form.project_title,
    source_id: form.source_id,
    company_name: profile?.company_name || "",
    cui_fiscal: profile?.cui || "",
    clarification_points: points,
    request_type: requestType,
    contact_email: user?.email,
    procedure_deadline: form.procedure_deadline || undefined,
    use_ai_expansion: useAi,
  });

  const handleGenerate = async () => {
    if (!form.authority_name.trim() || !points.trim()) {
      setError("Autoritatea contractantă și punctele solicitate sunt obligatorii.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      setData(await generateLegalClarification(payload()));
    } catch (e) {
      setError(e instanceof ApiError ? e.detail : "Generarea adresei a eșuat.");
    } finally {
      setLoading(false);
    }
  };

  const handleExport = async () => {
    setExporting(true);
    setError(null);
    try {
      await exportClarificationDocx(payload());
    } catch (e) {
      setError(e instanceof ApiError ? e.detail : "Exportul .docx a eșuat.");
    } finally {
      setExporting(false);
    }
  };

  return (
    <Panel className="p-4 sm:p-6">
      <h2 className="font-display text-2xl font-bold leading-tight tracking-tight">
        Solicitare oficială către autoritate
      </h2>
      <p className="font-body mt-1.5 text-sm leading-relaxed text-stock-600">
        Două instrumente distincte, cu termene și căi de atac diferite — alegeți-l pe cel potrivit situației.
      </p>

      <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2">
        {(
          [
            {
              id: "clarification" as const,
              title: "Clarificări · Legea 98/2016",
              body: "În interiorul unei proceduri active, pentru clauze restrictive sau cerințe neclare din documentație.",
            },
            {
              id: "foia" as const,
              title: "Informații publice · Legea 544/2001",
              body: "În afara unei proceduri, pentru documente și informații de interes public deținute de autoritate.",
            },
          ]
        ).map((opt) => (
          <button
            key={opt.id}
            onClick={() => setRequestType(opt.id)}
            aria-pressed={requestType === opt.id}
            className={
              "rounded-2xl bg-paper p-4 text-left transition-all duration-300 " +
              (requestType === opt.id
                ? "neu-pressed border-l-[3px] border-editorial bg-editorial-soft"
                : "neu-flat-sm hover:neu-flat")
            }
          >
            <h3 className="font-display text-base font-semibold leading-snug">{opt.title}</h3>
            <p className="font-body mt-1 text-xs leading-relaxed text-stock-500">{opt.body}</p>
          </button>
        ))}
      </div>

      <div className="mt-6 grid grid-cols-1 gap-5 sm:grid-cols-2">
        <Field label="Autoritate contractantă">
          <Input
            value={form.authority_name}
            onChange={(e) => setForm({ ...form, authority_name: e.target.value })}
          />
        </Field>
        <Field label="ID anunț / sursă">
          <Input value={form.source_id} onChange={(e) => setForm({ ...form, source_id: e.target.value })} />
        </Field>
        <Field label="Titlu proiect" className="sm:col-span-2">
          <Input
            value={form.project_title}
            onChange={(e) => setForm({ ...form, project_title: e.target.value })}
          />
        </Field>
        <Field
          label="Termen limită procedură"
          hint="Opțional. Apare în adresă ca reper pentru termenul de răspuns."
          className="sm:col-span-2"
        >
          <Input
            type="date"
            value={form.procedure_deadline}
            onChange={(e) => setForm({ ...form, procedure_deadline: e.target.value })}
          />
        </Field>
      </div>

      <div className="mt-5">
        <Field label="Puncte solicitate / clauze contestate">
          <Textarea value={points} onChange={(e) => setPoints(e.target.value)} className="min-h-[10rem]" />
        </Field>
      </div>

      <div className="mt-5 border-t border-divider pt-4">
        <Checkbox
          label="Extinde argumentația juridică cu AI"
          checked={useAi}
          onChange={(e) => setUseAi(e.target.checked)}
        />
      </div>

      {error && (
        <div className="mt-5">
          <Notice tone="alert">{error}</Notice>
        </div>
      )}

      <Button onClick={handleGenerate} disabled={loading} fullWidth className="mt-6">
        {loading ? "Se redactează adresa…" : "Generează adresa oficială"}
      </Button>

      {loading && (
        <div className="mt-6">
          <Loading label="Se redactează documentul" />
        </div>
      )}

      {data && !loading && (
        <>
          {data.recipient && (
            <p className="font-mono mt-6 text-[11px] uppercase tracking-wider text-stock-500">
              Destinatar: <span className="text-ink">{data.recipient}</span>
              {data.reference_id && ` · Ref. ${data.reference_id}`}
            </p>
          )}
          <DocumentOutput
            text={data.generated_letter}
            onCopy={() => copy(data.generated_letter)}
            copied={copied}
            failed={failed}
            onExport={handleExport}
            exporting={exporting}
          />
          {data.disclaimer && (
            <p className="font-mono mt-4 text-[11px] leading-relaxed text-stock-500">{data.disclaimer}</p>
          )}
        </>
      )}
    </Panel>
  );
}

/* ------------------------------------------------------------------ shell */

function DraftingContent() {
  const searchParams = useSearchParams();
  const requested = searchParams.get("tool");
  const [activeTool, setActiveTool] = useState<ToolId>(requested === "clarification" ? "clarification" : "proposal");

  const initial = {
    project_title: searchParams.get("project_title") || "",
    authority_name: searchParams.get("authority_name") || "",
    county: searchParams.get("county") || "",
    category: searchParams.get("category") || "",
    source_id: searchParams.get("source_id") || "",
    budget: searchParams.get("budget") || "",
  };

  return (
    <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-6 sm:py-8">
      <PageHeader
        eyebrow="Redactare documente"
        title="Documente de procedură"
        standfirst="Propuneri tehnice și solicitări oficiale generate din datele dosarului, exportabile în .docx pentru depunere."
      />

      <TabBar tabs={TOOLS} active={activeTool} onChange={setActiveTool} label="Instrument de redactare" />

      {activeTool === "proposal" ? (
        <TechnicalProposalTool initial={initial} />
      ) : (
        <ClarificationTool initial={initial} />
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
          <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-10">
            <Loading />
          </main>
        }
      >
        <DraftingContent />
      </Suspense>
    </AuthGate>
  );
}
